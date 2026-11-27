/**
 * Resize and square-crop uploaded portrait images for profile avatars.
 */
export function resizeImageFile(file: File, maxSize = 256, quality = 0.84): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('ไม่สามารถอ่านไฟล์รูปภาพได้'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('ไฟล์รูปภาพไม่ถูกต้อง'));
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('ไม่รองรับการประมวลผลรูปภาพ'));
          return;
        }

        const side = Math.min(img.width, img.height);
        const sx = (img.width - side) / 2;
        const sy = (img.height - side) / 2;

        const targetSize = Math.min(maxSize, side);
        canvas.width = targetSize;
        canvas.height = targetSize;

        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, sx, sy, side, side, 0, 0, targetSize, targetSize);

        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

/**
 * Resize family album/gallery photos while preserving original aspect ratio.
 */
export function resizeGalleryImageFile(file: File, maxDim = 760, quality = 0.8): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('ไม่สามารถอ่านไฟล์รูปภาพได้'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('ไฟล์รูปภาพไม่ถูกต้อง'));
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('ไม่รองรับการประมวลผลรูปภาพ'));
          return;
        }

        let targetW = img.width;
        let targetH = img.height;
        if (targetW > maxDim || targetH > maxDim) {
          if (targetW >= targetH) {
            targetH = Math.round((img.height * maxDim) / img.width);
            targetW = maxDim;
          } else {
            targetW = Math.round((img.width * maxDim) / img.height);
            targetH = maxDim;
          }
        }

        canvas.width = targetW;
        canvas.height = targetH;
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, targetW, targetH);

        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

export function getInitials(firstName?: string, nickname?: string): string {
  const source = (nickname || firstName || '?').trim();
  if (!source) return '?';
  const chars = Array.from(source);
  return chars.slice(0, 2).join('').toUpperCase();
}
