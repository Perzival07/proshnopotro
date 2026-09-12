import { v2 as cloudinary } from "cloudinary";

/**
 * Server-side Cloudinary access. The API secret never leaves the server: the
 * browser uploads with a short-lived signature issued here, and the tutor
 * views pages through signed URLs issued here.
 *
 * Accepts either the three separate variables or the single CLOUDINARY_URL
 * that the Cloudinary dashboard hands out.
 */
function readConfig() {
  const fromUrl = process.env.CLOUDINARY_URL
    ? (() => {
        try {
          const u = new URL(process.env.CLOUDINARY_URL);
          return {
            cloudName: u.hostname,
            apiKey: decodeURIComponent(u.username),
            apiSecret: decodeURIComponent(u.password),
          };
        } catch {
          return null;
        }
      })()
    : null;

  const cloudName = process.env.CLOUDINARY_CLOUD_NAME || fromUrl?.cloudName;
  const apiKey = process.env.CLOUDINARY_API_KEY || fromUrl?.apiKey;
  const apiSecret = process.env.CLOUDINARY_API_SECRET || fromUrl?.apiSecret;

  if (!cloudName || !apiKey || !apiSecret) return null;
  return { cloudName, apiKey, apiSecret };
}

let configured = false;

/** Null when the keys are missing, so callers can say so plainly. */
export function getCloudinary() {
  const config = readConfig();
  if (!config) return null;
  if (!configured) {
    cloudinary.config({
      cloud_name: config.cloudName,
      api_key: config.apiKey,
      api_secret: config.apiSecret,
      secure: true,
    });
    configured = true;
  }
  return { cloudinary, ...config };
}

/** Uploads are authenticated: nobody can open them without a signed URL. */
export const ANSWER_DELIVERY_TYPE = "authenticated";

export interface UploadSignature {
  cloudName: string;
  apiKey: string;
  timestamp: number;
  signature: string;
  folder: string;
  type: string;
}

/** Signs a direct browser upload pinned to one folder. */
export function signAnswerUpload(folder: string): UploadSignature | null {
  const c = getCloudinary();
  if (!c) return null;
  const timestamp = Math.floor(Date.now() / 1000);
  const params = { folder, timestamp, type: ANSWER_DELIVERY_TYPE };
  const signature = c.cloudinary.utils.api_sign_request(params, c.apiSecret);
  return {
    cloudName: c.cloudName,
    apiKey: c.apiKey,
    timestamp,
    signature,
    folder,
    type: ANSWER_DELIVERY_TYPE,
  };
}

/** A signed link to one page, optionally resized for a thumbnail. */
export function signedAnswerUrl(
  image: { publicId: string; version: number; format: string },
  width?: number
): string | null {
  const c = getCloudinary();
  if (!c) return null;
  return c.cloudinary.url(image.publicId, {
    type: ANSWER_DELIVERY_TYPE,
    sign_url: true,
    secure: true,
    version: image.version,
    format: image.format,
    ...(width
      ? { transformation: [{ width, crop: "limit", quality: "auto", fetch_format: "auto" }] }
      : {}),
  });
}
