"use client";

/**
 * Seçilen fotoğrafı kare kırpıp küçültür ve JPEG data URL döndürür.
 * Böylece büyük dosyalar sunucuya yüklenmeden önce ~20-60 KB'a iner.
 */
export const MAX_UPLOAD_BYTES = 12 * 1024 * 1024; // 12 MB ham dosya sınırı

export async function fileToSquareDataUrl(file: File, size = 256, quality = 0.85): Promise<string> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Lütfen bir görsel dosyası seçin (JPG, PNG veya WEBP).");
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new Error("Dosya çok büyük (en fazla 12 MB).");
  }

  const bitmap = await loadBitmap(file);
  try {
    // Merkezden kare kırpma
    const side = Math.min(bitmap.width, bitmap.height);
    const sx = Math.floor((bitmap.width - side) / 2);
    const sy = Math.floor((bitmap.height - side) / 2);

    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Görsel işlenemedi.");
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(bitmap, sx, sy, side, side, 0, 0, size, size);

    const dataUrl = canvas.toDataURL("image/jpeg", quality);
    if (!dataUrl.startsWith("data:image/jpeg;base64,")) throw new Error("Görsel dönüştürülemedi.");
    return dataUrl;
  } finally {
    if ("close" in bitmap && typeof bitmap.close === "function") bitmap.close();
  }
}

async function loadBitmap(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === "function") {
    try {
      return await createImageBitmap(file);
    } catch {
      /* yedek yönteme düş */
    }
  }
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Görsel okunamadı.")); };
    img.src = url;
  });
}
