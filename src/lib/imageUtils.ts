
/**
 * Converts an image file to WebP format using the browser's Canvas API.
 * This reduces file size while maintaining high quality.
 * 
 * @param file The original image file
 * @param quality Quality between 0 and 1 (default 0.8)
 * @returns A Promise resolving to the converted WebP File
 */
export const convertImageToWebP = (file: File, quality = 0.8): Promise<File> => {
  return new Promise((resolve, reject) => {
    // If it's already WebP or not an image, return original
    if (file.type === 'image/webp' || !file.type.startsWith('image/')) {
      resolve(file);
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        // Create canvas
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;

        // Draw image
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Could not get canvas context'));
          return;
        }
        ctx.drawImage(img, 0, 0);

        // Convert to WebP blob
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error('Canvas to Blob failed'));
              return;
            }

            // Safari can't encode WebP: canvas.toBlob silently falls back to
            // PNG. Use the blob's ACTUAL type (and matching extension) so the
            // declared MIME type never lies about the bytes — a mismatch gets
            // rejected by the server's magic-byte validation.
            const actualType = blob.type || 'image/png';
            const extensionByType: Record<string, string> = {
              'image/webp': '.webp',
              'image/png': '.png',
              'image/jpeg': '.jpg',
            };
            const newExtension = extensionByType[actualType] ?? '.png';
            const newName = file.name.replace(/\.[^/.]+$/, "") + newExtension;
            const newFile = new File([blob], newName, {
              type: actualType,
              lastModified: Date.now(),
            });

            resolve(newFile);
          },
          'image/webp',
          quality
        );
      };
      img.onerror = (err) => reject(err);
      img.src = event.target?.result as string;
    };
    reader.onerror = (err) => reject(err);
    reader.readAsDataURL(file);
  });
};
