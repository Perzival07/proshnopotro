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

// ─────────────────────────────────────────────────────────────
// NOTE FILES
// ─────────────────────────────────────────────────────────────

/**
 * Signs a direct browser upload of note files, pinned to one note's folder.
 *
 * The same signature serves both Cloudinary endpoints: `resource_type` lives
 * in the URL path, not in the signed parameters, so photos can go to /image
 * and PDFs to /raw without a second round trip for another signature.
 */
export function signNoteUpload(folder: string): UploadSignature | null {
  return signAnswerUpload(folder);
}

export interface StoredNoteFile {
  publicId: string;
  version: number;
  format: string;
  resourceType: string;
}

/**
 * A signed link to one note file, or to a thumbnail of it.
 *
 * Note files are uploaded as `authenticated`, exactly like answer sheets, so
 * a link that leaks is the only way in -- and these links are minted per
 * request for a student the note is actually shared with.
 *
 * Raw files (PDFs) carry their extension inside the public id and cannot be
 * transformed, so `width` is ignored for them.
 */
export function signedNoteUrl(
  file: StoredNoteFile,
  options: { width?: number; download?: boolean } = {}
): string | null {
  const c = getCloudinary();
  if (!c) return null;

  const isRaw = file.resourceType === "raw";
  const transformation = [
    ...(options.width && !isRaw
      ? [{ width: options.width, crop: "limit", quality: "auto", fetch_format: "auto" }]
      : []),
    ...(options.download ? [{ flags: "attachment" }] : []),
  ];

  return c.cloudinary.url(file.publicId, {
    resource_type: isRaw ? "raw" : "image",
    type: ANSWER_DELIVERY_TYPE,
    sign_url: true,
    secure: true,
    version: file.version,
    // A raw public id already ends in ".pdf"; appending the format again
    // would ask Cloudinary for "ch7.pdf.pdf", which does not exist.
    ...(isRaw ? {} : { format: file.format }),
    ...(transformation.length ? { transformation } : {}),
  });
}

/**
 * Removes a note file from Cloudinary.
 *
 * Best effort by design: the database row is the record of what a student can
 * see, so a failed destroy must not stop the tutor deleting a note. It only
 * leaves a stored file nobody has a link to.
 */
export async function destroyNoteFile(file: StoredNoteFile): Promise<boolean> {
  const c = getCloudinary();
  if (!c) return false;
  try {
    await c.cloudinary.uploader.destroy(file.publicId, {
      resource_type: file.resourceType === "raw" ? "raw" : "image",
      type: ANSWER_DELIVERY_TYPE,
      invalidate: true,
    });
    return true;
  } catch (err) {
    console.error("Failed to remove a note file from Cloudinary:", err);
    return false;
  }
}
