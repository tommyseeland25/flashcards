const MAX_SIDE = 800; // pixels: plenty for a flashcard, keeps each image to a few dozen KB
const MAX_INPUT_BYTES = 20 * 1024 * 1024;

/**
 * Downscale a user-chosen image and re-encode it (WebP where supported, else PNG/JPEG),
 * so a 12-megapixel phone photo doesn't bloat IndexedDB or backups. Returns a Blob.
 * Throws an Error with a user-friendly message for non-images or unreadable files.
 */
export async function shrinkImage(file) {
  if (!file.type.startsWith('image/')) throw new Error('That file is not an image.');
  if (file.size > MAX_INPUT_BYTES) throw new Error('That image is too large (20 MB maximum).');

  let bitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error('That image could not be read.');
  }
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/webp', 0.82));
  if (!blob) throw new Error('That image could not be converted.');
  return blob;
}
