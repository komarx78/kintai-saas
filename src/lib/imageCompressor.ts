/**
 * クライアントサイド画像軽量化・圧縮ユーティリティ (Image Compressor)
 * スマホで撮影された大容量画像（5MB〜15MB）を、高画質を保ったまま100KB〜300KB程度に自動圧縮して保存します。
 */

export interface CompressionOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number; // 0.1 〜 1.0 (デフォルト 0.75)
}

/**
 * File オブジェクトを圧縮して Base64 文字列として返す
 */
export async function compressImageFile(file: File, options?: CompressionOptions): Promise<{
  base64: string;
  originalSize: number;
  compressedSize: number;
  fileName: string;
  mimeType: string;
}> {
  const maxWidth = options?.maxWidth || 1200;
  const maxHeight = options?.maxHeight || 1200;
  const quality = options?.quality || 0.75;

  return new Promise((resolve, reject) => {
    // PDF の場合は圧縮せずそのまま Base64 化
    if (file.type === 'application/pdf') {
      const reader = new FileReader();
      reader.onload = () => {
        const res = reader.result as string;
        resolve({
          base64: res,
          originalSize: file.size,
          compressedSize: file.size,
          fileName: file.name,
          mimeType: file.type
        });
      };
      reader.onerror = error => reject(error);
      reader.readAsDataURL(file);
      return;
    }

    const reader = new FileReader();
    reader.onload = event => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        // アスペクト比を維持しながら最大サイズ内にリサイズ
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
          reject(new Error('Canvas context not available'));
          return;
        }

        // 白背景で塗りつぶし（透過PNGをJPEG変換したときの黒化防止）
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);

        // JPEG で圧縮
        const mimeType = 'image/jpeg';
        const compressedBase64 = canvas.toDataURL(mimeType, quality);
        const compressedBytes = Math.round((compressedBase64.length * 3) / 4);

        resolve({
          base64: compressedBase64,
          originalSize: file.size,
          compressedSize: compressedBytes,
          fileName: file.name.replace(/\.[^/.]+$/, '.jpg'),
          mimeType
        });
      };
      img.onerror = err => reject(err);
      img.src = event.target?.result as string;
    };
    reader.onerror = error => reject(error);
    reader.readAsDataURL(file);
  });
}
