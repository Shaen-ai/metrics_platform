export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

export const MAX_UPLOAD_LABEL = "10 MB";

export class MaxUploadError extends Error {
  constructor(message = "MAX_UPLOAD") {
    super(message);
    this.name = "MaxUploadError";
  }
}

export function isFileOverMaxUpload(file: { size: number }): boolean {
  return file.size > MAX_UPLOAD_BYTES;
}

export function isMaxUploadError(err: unknown): err is MaxUploadError {
  return err instanceof MaxUploadError;
}

/** Any file in the list over max; returns the first or null. */
export function getFirstOversizeFile(
  files: { size: number }[]
): { size: number } | null {
  return files.find((f) => isFileOverMaxUpload(f)) ?? null;
}

export function isLikelyUploadSizeLimitMessage(msg: string): boolean {
  const m = msg.toLowerCase();
  if (m.includes("maxupload") || m.includes("max_upload")) return true;
  if (m.includes("10240") && m.includes("kilo")) return true;
  if (m.includes("upload_max_filesize") || m.includes("post_max_size")) return true;
  if (m.includes("php limit") || m.includes("ini_size") || m.includes("form_size"))
    return true;
  if (m.includes("file must be under 10") || m.includes("under 10mb")) return true;
  return false;
}

export function uploadErrorUserMessage(
  err: unknown,
  t: (key: string) => string
): string {
  if (isMaxUploadError(err)) return t("upload.tooLargeMessage");
  const msg = err instanceof Error ? err.message : String(err);
  if (isLikelyUploadSizeLimitMessage(msg)) return t("upload.tooLargeMessage");
  return msg;
}
