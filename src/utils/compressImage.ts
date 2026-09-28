/**
 * Compress and resize an image for faster uploads.
 * Max width 1200px (keeps aspect ratio), JPEG compress 0.65.
 * Returns original uri if compression fails or package is missing.
 *
 * Catalog / profile / logo uploads enforce a 5 MB original-file size limit
 * on both iOS and Android. Pickers must use catalogImagePickerOptions so the
 * original file is measured before any quality compression.
 */
import * as FileSystem from 'expo-file-system';

const MAX_WIDTH = 1200;
const COMPRESS = 0.65;

/** Max size for product, category, service, profile, logo, and maintenance images. */
export const MAX_CATALOG_IMAGE_MB = 5;
export const MAX_CATALOG_IMAGE_BYTES = MAX_CATALOG_IMAGE_MB * 1024 * 1024;

/** Max size for vendor trade license and Emirates ID uploads. */
export const MAX_VENDOR_DOCUMENT_MB = 10;
export const MAX_VENDOR_DOCUMENT_BYTES = MAX_VENDOR_DOCUMENT_MB * 1024 * 1024;

export class ImageTooLargeError extends Error {
  readonly maxMb: number;

  constructor(maxMb: number = MAX_CATALOG_IMAGE_MB) {
    super(
      `You can upload an image of up to ${maxMb} MB only. Please choose a smaller file.`
    );
    this.name = 'ImageTooLargeError';
    this.maxMb = maxMb;
  }
}

export function isImageTooLargeError(err: unknown): err is ImageTooLargeError {
  return (
    err instanceof ImageTooLargeError ||
    (typeof err === 'object' &&
      err !== null &&
      (err as { name?: string }).name === 'ImageTooLargeError')
  );
}

export function catalogImageTooLargeMessage(maxMb: number = MAX_CATALOG_IMAGE_MB): string {
  return `You can upload an image of up to ${maxMb} MB only. Please choose a smaller file.`;
}

/**
 * Pick original image bytes so the 5 MB check runs on the real file.
 * quality < 1 (or allowsEditing) makes ImagePicker transcode first and hide a 6 MB original.
 */
export function catalogImagePickerOptions(options?: {
  allowsMultipleSelection?: boolean;
  allowsEditing?: boolean;
  aspect?: [number, number];
}) {
  return {
    mediaTypes: ['images'] as ['images'],
    allowsMultipleSelection: options?.allowsMultipleSelection ?? false,
    allowsEditing: options?.allowsEditing ?? false,
    aspect: options?.aspect,
    quality: 1,
  };
}

function asPositiveBytes(value: unknown): number | null {
  const n = typeof value === 'string' ? Number(value) : value;
  return typeof n === 'number' && Number.isFinite(n) && n > 0 ? Math.round(n) : null;
}

async function resolveImageFileSizeBytes(
  uri: string,
  knownSize?: number | null
): Promise<number | null> {
  const fromKnown = asPositiveBytes(knownSize);
  if (fromKnown != null) return fromKnown;

  try {
    const info = await FileSystem.getInfoAsync(uri, { size: true });
    const fromFs = asPositiveBytes(
      info.exists && 'size' in info ? (info as { size?: number }).size : null
    );
    if (fromFs != null) return fromFs;
  } catch {
    // try other methods
  }

  try {
    const response = await fetch(uri);
    const blob = await response.blob();
    const fromBlob = asPositiveBytes(blob?.size);
    if (fromBlob != null) return fromBlob;
  } catch {
    // try XHR
  }

  const fromXhr = await new Promise<number | null>((resolve) => {
    try {
      const xhr = new XMLHttpRequest();
      xhr.open('GET', uri, true);
      xhr.responseType = 'blob';
      xhr.onload = () => {
        const blob = xhr.response as Blob | null;
        resolve(asPositiveBytes(blob?.size));
      };
      xhr.onerror = () => resolve(null);
      xhr.send();
    } catch {
      resolve(null);
    }
  });
  return fromXhr;
}

/**
 * Rejects images larger than maxBytes (default 5 MB).
 * Throws ImageTooLargeError when over the limit.
 */
export async function ensureCatalogImageWithinLimit(
  uri: string,
  knownFileSize?: number | null,
  maxBytes: number = MAX_CATALOG_IMAGE_BYTES
): Promise<void> {
  const size = await resolveImageFileSizeBytes(uri, knownFileSize);
  if (size != null && size > maxBytes) {
    throw new ImageTooLargeError(Math.round(maxBytes / (1024 * 1024)));
  }
}

/** Size-check for vendor registration documents (trade license, Emirates ID). */
export async function ensureVendorDocumentWithinLimit(
  uri: string,
  knownFileSize?: number | null,
  maxMb: number = MAX_VENDOR_DOCUMENT_MB
): Promise<void> {
  await ensureCatalogImageWithinLimit(uri, knownFileSize, maxMb * 1024 * 1024);
}

export async function compressImageForUpload(uri: string): Promise<string> {
  try {
    const ImageManipulator = require('expo-image-manipulator');
    const result = await ImageManipulator.manipulateAsync(
      uri,
      [{ resize: { width: MAX_WIDTH } }],
      { compress: COMPRESS, format: ImageManipulator.SaveFormat?.JPEG ?? 'jpeg' }
    );
    return result?.uri ?? uri;
  } catch (_) {
    return uri;
  }
}

/**
 * Size-check (5 MB) then compress — product / category / service / profile / logo.
 */
export async function compressCatalogImageForUpload(
  uri: string,
  knownFileSize?: number | null
): Promise<string> {
  await ensureCatalogImageWithinLimit(uri, knownFileSize);
  return compressImageForUpload(uri);
}

/** Same 5 MB limit + compress for profile photos and business logos. */
export const compressProfileImageForUpload = compressCatalogImageForUpload;

/**
 * Compress multiple image URIs. Returns array of URIs (compressed or original on failure).
 */
export async function compressImagesForUpload(uris: string[]): Promise<string[]> {
  const results: string[] = [];
  for (const uri of uris) {
    results.push(await compressImageForUpload(uri));
  }
  return results;
}

/**
 * Size-check + compress for multiple catalog images.
 * Throws ImageTooLargeError if any asset exceeds the limit.
 */
export async function compressCatalogImagesForUpload(
  assets: Array<{ uri: string; fileSize?: number | null } | string>
): Promise<string[]> {
  const results: string[] = [];
  for (const item of assets) {
    const uri = typeof item === 'string' ? item : item.uri;
    const fileSize = typeof item === 'string' ? null : item.fileSize;
    results.push(await compressCatalogImageForUpload(uri, fileSize));
  }
  return results;
}
