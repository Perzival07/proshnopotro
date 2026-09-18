import type { UploadSignature } from "./cloudinary";

/** What Cloudinary reports about a file it accepted. */
export interface CloudinaryUploadResult {
  public_id: string;
  version: number;
  bytes?: number;
  width?: number;
  height?: number;
}

/**
 * Sends one photo from the browser straight to Cloudinary under a signature
 * the server issued.
 */
export async function uploadToCloudinary(
  sig: UploadSignature,
  file: Blob,
  fileName: string
): Promise<CloudinaryUploadResult> {
  const form = new FormData();
  form.append("file", file, fileName);
  form.append("api_key", sig.apiKey);
  form.append("timestamp", String(sig.timestamp));
  form.append("signature", sig.signature);
  form.append("folder", sig.folder);
  form.append("type", sig.type);

  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${sig.cloudName}/image/upload`,
    { method: "POST", body: form }
  );
  const body = await res.json().catch(() => null);
  if (!res.ok || !body?.public_id) {
    throw new Error(body?.error?.message || `${fileName} did not upload.`);
  }
  return body as CloudinaryUploadResult;
}
