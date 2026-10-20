import { getDb, newId } from './db.js';

/**
 * Card images live in their own object store as Blobs (cards only hold an `imageId`), so loading
 * a deck's cards never drags image bytes along. Images are immutable and may be shared by
 * duplicated decks, so they're never deleted when a card changes; `purgeOrphanImages` cleans up
 * unreferenced ones on startup instead.
 */

const urls = new Map(); // imageId -> object URL, so views can look images up synchronously

export async function saveImage(blob) {
  const id = newId();
  const db = await getDb();
  await db.put('images', { id, type: blob.type, blob });
  urls.set(id, URL.createObjectURL(blob));
  return id;
}

/** Load object URLs for every image the given cards use. Call once before rendering them. */
export async function loadImageUrls(cards) {
  const db = await getDb();
  const wanted = [...new Set(cards.map((c) => c.imageId).filter((id) => id && !urls.has(id)))];
  await Promise.all(wanted.map(async (id) => {
    const record = await db.get('images', id);
    if (record) urls.set(id, URL.createObjectURL(record.blob));
  }));
}

/** The URL for an image id (null if none or not loaded). */
export const imageUrl = (id) => (id ? urls.get(id) ?? null : null);

/** Delete stored images that no card references any more. */
export async function purgeOrphanImages() {
  const db = await getDb();
  const used = new Set((await db.getAll('cards')).map((c) => c.imageId).filter(Boolean));
  const tx = db.transaction('images', 'readwrite');
  for (const key of await tx.store.getAllKeys()) if (!used.has(key)) tx.store.delete(key);
  await tx.done;
}

// ---- backup support: images travel inside the JSON file as base64 ----

async function blobToBase64(blob) {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = '';
  // In chunks: spreading a huge array into fromCharCode would overflow the call stack.
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}

const base64ToBlob = (data, type) => new Blob([Uint8Array.from(atob(data), (c) => c.charCodeAt(0))], { type });

/** [{ id, type, data }] for the given image ids, ready for JSON. */
export async function exportImages(ids) {
  const db = await getDb();
  const records = await Promise.all([...new Set(ids)].map((id) => db.get('images', id)));
  return Promise.all(records.filter(Boolean).map(async (r) => ({ id: r.id, type: r.type, data: await blobToBase64(r.blob) })));
}

/** Convert backup entries back to stored records (used inside a restore transaction). */
export const toImageRecords = (images) => images.map(({ id, type, data }) => ({ id, type, blob: base64ToBlob(data, type) }));
