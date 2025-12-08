// upload.service.ts
import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { UTApi } from 'uploadthing/server';

@Injectable()
export class UploadService {
  private readonly logger = new Logger(UploadService.name);

  listLocalFiles(): Promise<string[]> {
    // Deprecated: keep for backward compatibility. Prefer `listEntries`.
    return this.listEntries().then((entries) => entries.map((e) => e.filename));
  }

  getLocalFilePath(name: string) {
    // returns absolute path usable by res.sendFile with root=process.cwd()
    return path.join('uploads', 'pdfs', name);
  }

  private getMetadataPath() {
    const dir = path.resolve(process.cwd(), 'uploads');
    if (!fs.existsSync(dir)) {
      try {
        fs.mkdirSync(dir, { recursive: true });
      } catch (e) {
        this.logger.error('Could not create uploads dir', e as any);
      }
    }
    return path.join(dir, 'metadata.json');
  }

  private async saveMetadataEntry(entry: Record<string, any>) {
    const metaPath = this.getMetadataPath();
    let arr: Record<string, any>[] = [];
    try {
      if (fs.existsSync(metaPath)) {
        const raw = fs.readFileSync(metaPath, 'utf8');
        arr = JSON.parse(raw || '[]');
      }
    } catch (e) {
      this.logger.warn('Could not read metadata file, will recreate', e as any);
      arr = [];
    }
    arr.push(entry);
    try {
      fs.writeFileSync(metaPath, JSON.stringify(arr, null, 2), 'utf8');
    } catch (e) {
      this.logger.error('Failed to write metadata file', e as any);
    }
  }

  /**
   * Return entries combining metadata (remote uploads) and local files.
   * Each entry: { filename, originalName?, size?, mimeType?, publicUrl?, uploadedAt? }
   */
  async listEntries(): Promise<Array<Record<string, any>>> {
    const entries: Record<string, any>[] = [];
    const metaPath = this.getMetadataPath();

    // Read metadata (remote upload records)
    try {
      if (fs.existsSync(metaPath)) {
        const raw = fs.readFileSync(metaPath, 'utf8');
        const arr = JSON.parse(raw || '[]');
        if (Array.isArray(arr)) entries.push(...arr);
      }
    } catch (e) {
      this.logger.error('Error reading metadata', e as any);
    }

    // Also include any local files not present in metadata
    const dir = path.resolve(process.cwd(), 'uploads', 'pdfs');
    try {
        
      if (fs.existsSync(dir)) {
        const files = fs.readdirSync(dir).filter((f) => fs.statSync(path.join(dir, f)).isFile());
        for (const f of files) {
          const already = entries.find((e) => e.filename === f);
          if (!already) {
            const stat = fs.statSync(path.join(dir, f));
            entries.push({
              filename: f,
              originalName: f,
              size: stat.size,
              mimeType: undefined,
              publicUrl: `/uploads/pdfs/${f}`,
              uploadedAt: stat.mtime.toISOString(),
            });
          }
        }
      }
    } catch (e) {
      this.logger.error('Error listing local upload files', e as any);
    }

    return entries;
  }

  // UTApi lee UPLOADTHING_TOKEN desde process.env por defecto,
  // pero si quieres puedes pasarlo explícito:
  private readonly utapi = new UTApi({
    token: process.env.UPLOADTHING_TOKEN ?? process.env.UPLOADTHING_SECRET,
  });

  async handleLocal(file: Express.Multer.File) {
    // 1) Guardado local (ya lo hace Multer si está configurado)
    const localPath = file.path || path.join('uploads', 'pdfs', file.filename);
    const publicUrl = file.path ? `/uploads/${path.relative('uploads', file.path).replace(/\\/g, '/')}` : `/uploads/pdfs/${file.filename}`;

    const result: any = {
      localPath,
      publicUrl,
      mimeType: file.mimetype,
      size: file.size,
    };

    // 2) Token de UploadThing (v7: UPLOADTHING_TOKEN)
    const token = process.env.UPLOADTHING_TOKEN ?? process.env.UPLOADTHING_SECRET;
    if (!token) {
      // Si no hay token, solo devolvemos info local
      this.logger.warn('No UPLOADTHING_TOKEN/UPLOADTHING_SECRET set, skipping UploadThing upload');
      return result;
    }

    // 3) Límite de tamaño opcional para evitar errores 413
    const maxBytes = parseInt(process.env.UPLOADTHING_MAX_BYTES ?? '1048576', 10); // 1 MB por defecto
    if (file.size && file.size > maxBytes) {
      result.uploadThingResult = {
        skipped: true,
        reason: `file size ${file.size} exceeds UPLOADTHING_MAX_BYTES=${maxBytes}`,
      };
      return result;
    }

    // 4) Intentar subir a UploadThing con UTApi
    try {
      const uploadRes = await this.uploadToUploadThing(file);
      result.uploadThingResult = {
        success: true,
        data: uploadRes,
      };
      // Save metadata entry so the file appears in listings
      try {
        // uploadRes can be various shapes; attempt to extract remote URL(s)
        const remoteUrls: string[] = [];
        // uploadRes types from UploadThing may not include the runtime URL fields in the TS types,
        // coerce to `any` to extract runtime properties safely.
        const anyRes: any = uploadRes as any;
        if (Array.isArray(anyRes)) {
          for (const item of anyRes) {
            const url = item?.ufsUrl ?? item?.url ?? item?.appUrl ?? item?.file?.ufsUrl ?? item?.file?.url;
            if (url) remoteUrls.push(url);
          }
        } else if (anyRes?.ufsUrl || anyRes?.url || anyRes?.appUrl) {
          const url = anyRes.ufsUrl ?? anyRes.url ?? anyRes.appUrl;
          remoteUrls.push(url);
        } else if (anyRes?.files && Array.isArray(anyRes.files)) {
          for (const item of anyRes.files) {
            const url = item?.ufsUrl ?? item?.url ?? item?.appUrl;
            if (url) remoteUrls.push(url);
          }
        }

        const entry = {
          filename: file.filename,
          originalName: file.originalname,
          size: file.size,
          mimeType: file.mimetype,
          uploadedAt: new Date().toISOString(),
          remoteUrls,
        };

        await this.saveMetadataEntry(entry);
      } catch (e) {
        this.logger.warn('Could not save metadata for uploaded file', e as any);
      }
    } catch (err: any) {
      this.logger.error('Error uploading to UploadThing', err?.message ?? err);
      result.uploadThingResult = {
        success: false,
        error: err?.message ?? String(err),
      };
    }

    return result;
  }

  private async uploadToUploadThing(file: Express.Multer.File) {
    // Ruta donde Multer guardó el archivo
    const filePath = file.path || path.resolve(process.cwd(), 'uploads', 'pdfs', file.filename);

    // Leemos el archivo como buffer
    const buffer = fs.readFileSync(filePath);

    // En Node 18+ existe global `File`. Si no, tendrías que usar un polyfill.
    const utFile = new File([buffer], file.originalname, { type: file.mimetype });

    // Subir archivo a UploadThing
    const res = await this.utapi.uploadFiles(utFile);

    // `res` incluye info como key, url pública, etc.
    return res;
  }
}
