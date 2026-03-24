import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { app } from './firebase';

const storage = getStorage(app);

const TARGET_WIDTH = 600;

/**
 * 이미지를 최대 TARGET_WIDTH(600px) 가로로 리사이즈.
 * 리사이즈 실패 시 원본 파일을 그대로 반환 (fallback).
 */
async function resizeImage(file: File): Promise<Blob> {
  try {
    return await new Promise<Blob>((resolve) => {
      const img = new Image();
      const url = URL.createObjectURL(file);

      img.onload = () => {
        URL.revokeObjectURL(url);

        if (img.width <= TARGET_WIDTH) {
          console.log('[resizeImage] 리사이즈 불필요:', img.width, 'x', img.height);
          resolve(file);
          return;
        }

        try {
          const ratio = TARGET_WIDTH / img.width;
          const newWidth = TARGET_WIDTH;
          const newHeight = Math.round(img.height * ratio);
          console.log('[resizeImage] 리사이즈:', img.width, '→', newWidth, 'x', newHeight);

          const canvas = document.createElement('canvas');
          canvas.width = newWidth;
          canvas.height = newHeight;

          const ctx = canvas.getContext('2d');
          if (!ctx) {
            console.warn('[resizeImage] canvas context 없음, 원본 사용');
            resolve(file);
            return;
          }

          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(img, 0, 0, newWidth, newHeight);

          const outputType = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
          const quality = outputType === 'image/jpeg' ? 0.92 : undefined;

          canvas.toBlob(
            (blob) => {
              if (blob) {
                console.log('[resizeImage] 완료, blob size:', blob.size);
                resolve(blob);
              } else {
                console.warn('[resizeImage] toBlob null, 원본 사용');
                resolve(file);
              }
            },
            outputType,
            quality
          );
        } catch (canvasErr) {
          console.warn('[resizeImage] canvas 에러, 원본 사용:', canvasErr);
          resolve(file);
        }
      };

      img.onerror = () => {
        URL.revokeObjectURL(url);
        console.warn('[resizeImage] 이미지 로드 실패, 원본 사용');
        resolve(file); // reject 대신 원본 반환
      };

      img.src = url;
    });
  } catch (err) {
    console.warn('[resizeImage] 전체 실패, 원본 사용:', err);
    return file;
  }
}

export async function uploadImage(file: File, problemId: string): Promise<string> {
  console.log('[uploadImage] 시작:', file.name, file.type, file.size, '→', problemId);

  const uploadBlob = await resizeImage(file);

  const timestamp = Date.now();
  const ext = file.type === 'image/png' ? '.png' : '.jpg';
  const baseName = file.name.replace(/\.[^.]+$/, '');
  const fileName = `${timestamp}-${baseName}${ext}`;
  const path = `problems/${problemId}/${fileName}`;
  console.log('[uploadImage] path:', path, 'size:', uploadBlob.size);

  const storageRef = ref(storage, path);

  console.log('[uploadImage] uploadBytes 시작...');
  await uploadBytes(storageRef, uploadBlob);
  console.log('[uploadImage] uploadBytes 완료');

  const url = await getDownloadURL(storageRef);
  console.log('[uploadImage] URL 획득 완료');
  return url;
}