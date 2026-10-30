import { v2 as cloudinary } from "cloudinary";
import { classifyDeletion, inBatches } from "./photo-cleanup";

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
  /** Set when the signature is pinned to one file; the upload then sends this, not the folder. */
  publicId?: string;
}

/**
 * Signs a direct browser upload pinned to one folder, or, with `publicId`, to
 * one file. Cloudinary honours a signature for an hour and cannot be told
 * otherwise, so pinning the name is what stops a signature from being used to
 * add files: the same signature can only write the same file again.
 */
export function signAnswerUpload(folder: string, publicId?: string): UploadSignature | null {
  const c = getCloudinary();
  if (!c) return null;
  const timestamp = Math.floor(Date.now() / 1000);
  const params = publicId
    ? { public_id: publicId, overwrite: "true", timestamp, type: ANSWER_DELIVERY_TYPE }
    : { folder, timestamp, type: ANSWER_DELIVERY_TYPE };
  const signature = c.cloudinary.utils.api_sign_request(params, c.apiSecret);
  return {
    cloudName: c.cloudName,
    apiKey: c.apiKey,
    timestamp,
    signature,
    folder,
    type: ANSWER_DELIVERY_TYPE,
    ...(publicId ? { publicId } : {}),
  };
}

export interface StoredAnswerPage {
  publicId: string;
  version: number;
  format: string;
  width: number | null;
  height: number | null;
  bytes: number | null;
}

/**
 * Asks Cloudinary what it actually holds for these ids, so the database is
 * written from the stored files and not from what the browser claims. Ids that
 * are not there are left out of the result. Null when Cloudinary is not
 * configured or cannot be reached.
 */
export async function lookupAnswerPages(publicIds: string[]): Promise<StoredAnswerPage[] | null> {
  const c = getCloudinary();
  if (!c) return null;
  try {
    const res = await c.cloudinary.api.resources_by_ids(publicIds, {
      type: ANSWER_DELIVERY_TYPE,
      resource_type: "image",
    });
    return (res?.resources ?? []).map(
      (r: { public_id: string; version: number; format: string; width?: number; height?: number; bytes?: number }) => ({
        publicId: r.public_id,
        version: r.version,
        format: r.format,
        width: r.width ?? null,
        height: r.height ?? null,
        bytes: r.bytes ?? null,
      })
    );
  } catch (err) {
    console.error("Failed to look up answer photos in Cloudinary:", err);
    return null;
  }
}

/**
 * Deletes the files in an assignment's answer folder that are not in `keep`:
 * pages uploaded but never saved. Best effort, like the other clean-ups; a
 * failure only leaves files nothing points at.
 */
export async function pruneAnswerFolder(assignmentId: string, keep: string[]): Promise<void> {
  const c = getCloudinary();
  if (!c) return;
  try {
    const res = await c.cloudinary.api.resources({
      type: ANSWER_DELIVERY_TYPE,
      resource_type: "image",
      prefix: `proshnopotro/answers/${assignmentId}/`,
      max_results: 100,
    });
    const stray = (res?.resources ?? [])
      .map((r: { public_id: string }) => r.public_id)
      .filter((id: string) => !keep.includes(id));
    if (stray.length > 0) await destroyAnswerImages(stray);
  } catch (err) {
    console.error(`Failed to prune stray answer photos for ${assignmentId}:`, err);
  }
}

/**
 * Signs a direct browser upload of an image for a question, pinned to the
 * test's folder. Unlike answer sheets these are public: they are shown inside
 * the question paper, and the random name Cloudinary gives each one means
 * nobody can find it before the paper opens.
 */
export function signQuestionImageUpload(folder: string): UploadSignature | null {
  const c = getCloudinary();
  if (!c) return null;
  const timestamp = Math.floor(Date.now() / 1000);
  const params = { folder, timestamp, type: "upload" };
  const signature = c.cloudinary.utils.api_sign_request(params, c.apiSecret);
  return { cloudName: c.cloudName, apiKey: c.apiKey, timestamp, signature, folder, type: "upload" };
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
 * Signs a direct browser upload of note photos, pinned to one note's folder.
 * PDFs are never uploaded; a note shares one as a Google Drive link.
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
 * A signed CDN link to one note photo, or to a thumbnail of it.
 *
 * Note files are uploaded as `authenticated`, exactly like answer sheets, so
 * a link that leaks is the only way in -- and these links are minted per
 * request for a student the note is actually shared with.
 */
export function signedNoteUrl(
  file: StoredNoteFile,
  options: { width?: number } = {}
): string | null {
  const c = getCloudinary();
  if (!c) return null;

  return c.cloudinary.url(file.publicId, {
    resource_type: "image",
    type: ANSWER_DELIVERY_TYPE,
    sign_url: true,
    secure: true,
    version: file.version,
    format: file.format,
    ...(options.width
      ? {
          transformation: [
            { width: options.width, crop: "limit", quality: "auto", fetch_format: "auto" },
          ],
        }
      : {}),
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

/**
 * Removes answer photos from Cloudinary and says which are gone. When
 * Cloudinary is not configured there are no real files to remove (nothing
 * could have been uploaded), so every id counts as gone.
 */
export async function destroyAnswerImages(publicIds: string[]): Promise<{ gone: string[]; failed: string[] }> {
  const c = getCloudinary();
  if (!c) return { gone: publicIds, failed: [] };
  const gone: string[] = [];
  const failed: string[] = [];
  for (const batch of inBatches(publicIds)) {
    try {
      const res = await c.cloudinary.api.delete_resources(batch, {
        type: ANSWER_DELIVERY_TYPE,
        resource_type: "image",
        invalidate: true,
      });
      const r = classifyDeletion(batch, res?.deleted);
      gone.push(...r.gone);
      failed.push(...r.failed);
    } catch (err) {
      console.error("Failed to delete answer photos from Cloudinary:", err);
      failed.push(...batch);
    }
  }
  return { gone, failed };
}

/**
 * Empties an assignment's answer folder in Cloudinary. Used when an attempt
 * is reopened: its AnswerImage rows go, and without this the files would stay
 * in storage with nothing pointing at them. Best effort: a storage hiccup
 * must not stop a reopen, so failure is logged, not thrown.
 */
export async function destroyAnswerFolder(assignmentId: string): Promise<void> {
  const c = getCloudinary();
  if (!c) return;
  try {
    await c.cloudinary.api.delete_resources_by_prefix(`proshnopotro/answers/${assignmentId}/`, {
      type: ANSWER_DELIVERY_TYPE,
      invalidate: true,
    });
  } catch (err) {
    console.error(`Failed to clear answer photos for ${assignmentId}:`, err);
  }
}
