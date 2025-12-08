export class UploadResponseDto {
  /** Local path where the file was stored (relative to project root) */
  localPath: string;

  /** Public URL served by the app (if available) */
  publicUrl?: string;

  /** If UploadThing upload was attempted, this will contain the remote response or error message */
  uploadThingResult?: any;

  /** MIME type of the uploaded file */
  mimeType?: string;
}
