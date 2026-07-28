/** Compress screenshot data URLs before sending to vision models. */

const MAX_IMAGES = 3;
const MAX_EDGE = 1280;
const JPEG_QUALITY = 0.72;

export type ContextImagePayload = {
  fileName?: string;
  dataUrl: string;
  mimeType: string;
};

function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Could not read image'));
    img.src = dataUrl;
  });
}

async function compressDataUrl(dataUrl: string): Promise<{ dataUrl: string; mimeType: string } | null> {
  if (!dataUrl.startsWith('data:image/')) return null;
  try {
    const img = await loadImage(dataUrl);
    const scale = Math.min(1, MAX_EDGE / Math.max(img.width, img.height));
    const w = Math.max(1, Math.round(img.width * scale));
    const h = Math.max(1, Math.round(img.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return { dataUrl, mimeType: dataUrl.slice(5, dataUrl.indexOf(';')) || 'image/jpeg' };
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);
    const out = canvas.toDataURL('image/jpeg', JPEG_QUALITY);
    return { dataUrl: out, mimeType: 'image/jpeg' };
  } catch {
    return null;
  }
}

/** Prepare up to 3 image attachments for the outreach coach (vision). */
export async function prepareContextImagesForAi(
  entries: Array<{ fileName?: string; text?: string; fileDataUrl?: string }>
): Promise<ContextImagePayload[]> {
  const imageEntries = entries.filter(
    (e) =>
      Boolean(e.fileDataUrl?.startsWith('data:image/')) ||
      /\.(png|jpe?g|gif|webp)$/i.test(e.fileName ?? e.text ?? '')
  );
  const prepared: ContextImagePayload[] = [];
  for (const entry of imageEntries.slice(0, MAX_IMAGES)) {
    if (!entry.fileDataUrl) continue;
    const compressed = await compressDataUrl(entry.fileDataUrl);
    if (!compressed) continue;
    prepared.push({
      fileName: entry.fileName ?? entry.text,
      dataUrl: compressed.dataUrl,
      mimeType: compressed.mimeType,
    });
  }
  return prepared;
}
