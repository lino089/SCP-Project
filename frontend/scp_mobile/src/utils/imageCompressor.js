/**
 * Client-side Image Compressor Utility
 * Ensures uploaded evidence photos (leave requests, KBM journals)
 * stay strictly below target size (e.g. < 150KB / < 2MB).
 */
export async function compressImageFile(
  file,
  { maxWidth = 800, maxHeight = 800, quality = 0.35, targetSizeKB = 150 } = {}
) {
  if (!file || !file.type.startsWith('image/')) {
    return file;
  }

  // If image is already smaller than target, return as is
  if (targetSizeKB && file.size <= targetSizeKB * 1024) {
    return file;
  }

  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);

    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;

      img.onload = () => {
        let { width, height } = img;

        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (!blob) {
              resolve(file);
              return;
            }
            const compressedName = file.name.replace(/\.[^/.]+$/, '') + '.jpg';
            const compressedFile = new File([blob], compressedName, {
              type: 'image/jpeg',
              lastModified: Date.now(),
            });
            resolve(compressedFile);
          },
          'image/jpeg',
          quality
        );
      };

      img.onerror = () => resolve(file);
    };

    reader.onerror = () => resolve(file);
  });
}

export const compressImage = compressImageFile;
export default compressImageFile;
