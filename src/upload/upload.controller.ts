// upload.controller.ts
import {
  Controller,
  Post,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  Get,
  Param,
  Res,
  HttpStatus,
  Req,
  Logger,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { UploadService } from './upload.service';
import { UploadResponseDto } from './dto/upload-response.dto';
import type { Response, Request } from 'express';

function fileFilter(req: any, file: Express.Multer.File, cb: Function) {
  const ext = extname(file.originalname).toLowerCase();
  const allowedMime = ['application/pdf', 'image/jpeg'];
  const allowedExt = ['.pdf', '.jpg', '.jpeg'];

  const allowed = allowedMime.includes(file.mimetype) || allowedExt.includes(ext);
  if (!allowed) {
    return cb(new BadRequestException('Only PDF or JPG files are allowed'), false);
  }
  cb(null, true);
}

@Controller('upload')
export class UploadController {
  private readonly logger = new Logger(UploadController.name);

  constructor(private readonly uploadService: UploadService) {}

  @Post('pdf')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: './uploads/pdfs',
        filename: (req, file, cb) => {
          const rnd = Date.now();
          const name = `${rnd}-${file.originalname.replace(/[^a-zA-Z0-9.\-]/g, '_')}`;
          cb(null, name);
        },
      }),
      fileFilter: fileFilter,
      limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
    }),
  )
  async uploadPdf(@UploadedFile() file: Express.Multer.File): Promise<UploadResponseDto> {
    if (!file) throw new BadRequestException('No file uploaded');

    const res = await this.uploadService.handleLocal(file);
    return res;
  }

  @Get()
  async listFiles(): Promise<any[]> {
    const entries = await this.uploadService.listEntries();
    this.logger.log(`Listing ${entries.length} uploaded files`);

    const base = process.env.BACK_URL ?? '';
    // Build publicUrl using remoteUrls if present, otherwise local public path
    return entries.map((e) => {
      const publicUrl = (e.remoteUrls && e.remoteUrls.length > 0) ? e.remoteUrls[0] : `${base}/uploads/pdfs/${e.filename}`;
      return {
        filename: String(e.filename),
        originalName: e.originalName ? String(e.originalName) : String(e.filename),
        size: typeof e.size === 'number' ? e.size : undefined,
        mimeType: e.mimeType ? String(e.mimeType) : undefined,
        uploadedAt: e.uploadedAt ? String(e.uploadedAt) : undefined,
        publicUrl: String(publicUrl),
        remoteUrls: Array.isArray(e.remoteUrls) ? e.remoteUrls.map(String) : undefined,
      } as any;
    });
  }

  @Get(':name')
  async getFile(@Param('name') name: string, @Req() req: Request, @Res() res: Response) {
    // Use listEntries so we include remote entries saved in metadata as well as local files
    const entries = await this.uploadService.listEntries();
    const entry = entries.find((e) => e.filename === name);
    if (!entry) {
      this.logger.warn(`Requested file not found: ${name}`);
      return res.status(HttpStatus.NOT_FOUND).json({ error: 'Not Found' });
    }
  
    // If remoteUrls are present prefer the first remote URL (UploadThing UFS URL)
    let publicUrl: string | undefined = undefined;
    if (entry.remoteUrls && Array.isArray(entry.remoteUrls) && entry.remoteUrls.length > 0) {
      publicUrl = entry.remoteUrls[0];
    } else {
      const base = process.env.BACK_URL ?? `${req.protocol}://${req.get('host')}`;
      publicUrl = `${base}/uploads/pdfs/${entry.filename}`;
    }

    this.logger.log(`Providing public URL for ${name}: ${publicUrl}`);
    return res.status(HttpStatus.OK).json({ filename: name, publicUrl });
  }
}
