/**
 * Utility functions for adding watermarks to images
 * Used for free tier teaser previews
 */

/**
 * Creates a watermarked image URL using canvas
 * This adds a "Lowcountry Listings" watermark to free tier previews
 */
export async function addWatermarkToImage(
  imageUrl: string,
  text: string = 'Lowcountry Listings'
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        reject(new Error('Could not get canvas context'));
        return;
      }

      // Draw the original image
      ctx.drawImage(img, 0, 0);

      // Add watermark
      ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
      ctx.font = 'bold 24px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      // Calculate text position (center of image)
      const x = canvas.width / 2;
      const y = canvas.height / 2;

      // Draw text with shadow for visibility
      ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
      ctx.shadowBlur = 10;
      ctx.shadowOffsetX = 2;
      ctx.shadowOffsetY = 2;
      ctx.fillText(text, x, y);

      // Also add "Premium Feature" text
      ctx.font = '16px Arial';
      ctx.fillText('Upgrade to unlock', x, y + 35);

      // Convert to data URL
      const watermarkedUrl = canvas.toDataURL('image/jpeg', 0.9);
      resolve(watermarkedUrl);
    };

    img.onerror = () => {
      reject(new Error('Failed to load image'));
    };

    img.src = imageUrl;
  });
}

/**
 * Creates a CSS-based watermark overlay
 * This is a simpler approach that doesn't require canvas manipulation
 */
export function createWatermarkOverlay(text: string = 'Lowcountry Listings'): string {
  return `
    position: relative;
  `;
}

