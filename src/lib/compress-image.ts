/**
 * Shrinks a photo in the browser before upload: no wider than `maxWidth`,
 * re-encoded as WebP (JPEG where the browser can't write WebP), stepping
 * the quality down until it fits under `maxBytes`. Keeps uploads inside
 * the server-action size limit and keeps the public pages fast.
 */
export async function compressImage(file: File, maxWidth: number, maxBytes = 900 * 1024): Promise<File> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxWidth / bitmap.width);
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("canvas");
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const encode = (type: string, quality: number) =>
    new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));

  for (const quality of [0.82, 0.74, 0.66, 0.58, 0.5]) {
    let blob = await encode("image/webp", quality);
    // Some browsers quietly return PNG when they can't write WebP.
    if (!blob || blob.type !== "image/webp") blob = await encode("image/jpeg", quality);
    if (blob && blob.size <= maxBytes) {
      const extension = blob.type === "image/webp" ? "webp" : "jpg";
      return new File([blob], `photo.${extension}`, { type: blob.type });
    }
  }
  throw new Error("too-large");
}
