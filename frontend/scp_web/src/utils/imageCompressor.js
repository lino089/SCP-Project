/**
 * Utilitas Kompresi Foto Dokumentasi KBM Sisi Klien (HTML5 Canvas)
 * Mengoptimalkan ukuran gambar sebelum diunggah ke backend melalui multipart FormData.
 * Sesuai PRD: Membatasi dimensi maksimum (1280px) dan kompresi JPEG quality ~0.8 (<400KB).
 */

export async function compressImage(file, options = {}) {
  const {
    maxWidth = 1280,
    maxHeight = 1280,
    quality = 0.8,
    outputType = 'image/jpeg',
  } = options;

  if (!file || !file.type.startsWith('image/')) {
    return file;
  }

  // Jika ukuran file sudah sangat kecil (< 150KB), tidak perlu kompresi ulang
  if (file.size <= 150 * 1024) {
    return file;
  }

  return new Promise((resolve) => {
    try {
      const img = new Image();
      const objectUrl = URL.createObjectURL(file);

      img.onload = () => {
        URL.revokeObjectURL(objectUrl);

        let { width, height } = img;

        if (width > maxWidth || height > maxHeight) {
          if (width > height) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          } else {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          return resolve(file); // Fallback ke file asli jika canvas context gagal
        }

        // Draw image onto canvas
        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (!blob) {
              return resolve(file);
            }

            // Ganti ekstensi jika dikonversi ke JPEG
            const baseName = file.name.replace(/\.[^/.]+$/, '');
            const newFileName = `${baseName}.jpg`;

            const compressedFile = new File([blob], newFileName, {
              type: outputType,
              lastModified: Date.now(),
            });

            resolve(compressedFile);
          },
          outputType,
          quality
        );
      };

      img.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        resolve(file); // Fallback ke file asli
      };

      img.src = objectUrl;
    } catch {
      resolve(file);
    }
  });
}

export default compressImage;
