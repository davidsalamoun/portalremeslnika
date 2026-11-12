/**
 * Zmenší a zkomprimuje obrázek na straně klienta pomocí HTML Canvas.
 * Zajišťuje, že soubory v base64 nezahltí localStorage (cca 80–140 KB místo 6 MB).
 */
export async function compressImageFile(
  file: File,
  maxWidth = 1200,
  maxHeight = 1200,
  quality = 0.75
): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (readerEvent) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Nelze vytvořit 2D kontext canvasu'));
          return;
        }

        // Bílé pozadí pro případ průhlednosti
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, width, height);

        ctx.drawImage(img, 0, 0, width, height);

        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        resolve(dataUrl);
      };
      img.onerror = () => reject(new Error('Chyba při načítání obrázku'));
      img.src = readerEvent.target?.result as string;
    };
    reader.onerror = () => reject(new Error('Chyba při čtení souboru'));
    reader.readAsDataURL(file);
  });
}
