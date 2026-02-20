'use client';

import { useRef, useState } from 'react';

interface ImageUploadButtonProps {
  onUpload: (file: File) => Promise<void>;
}

export default function ImageUploadButton({ onUpload }: ImageUploadButtonProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  const handleChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // 이미지 파일만 허용
    if (!file.type.startsWith('image/')) {
      alert('이미지 파일만 업로드할 수 있습니다.');
      return;
    }

    // 5MB 제한
    if (file.size > 5 * 1024 * 1024) {
      alert('파일 크기는 5MB 이하만 가능합니다.');
      return;
    }

    try {
      setUploading(true);
      await onUpload(file);
    } catch (error) {
      console.error('업로드 에러:', error);
      alert('이미지 업로드에 실패했습니다.');
    } finally {
      setUploading(false);
      // input 초기화 (같은 파일 재업로드 가능하도록)
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleChange}
        style={{ display: 'none' }}
      />
      <button
        onClick={handleClick}
        disabled={uploading}
        title="이미지 업로드"
        style={{
          padding: '4px 10px',
          fontSize: '14px',
          backgroundColor: uploading ? '#eee' : '#fff',
          border: '1px solid #ccc',
          borderRadius: '4px',
          cursor: uploading ? 'not-allowed' : 'pointer',
          minWidth: '36px',
          lineHeight: '1.4',
        }}
        onMouseEnter={(e) => {
          if (!uploading) e.currentTarget.style.backgroundColor = '#e8e8e8';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = uploading ? '#eee' : '#fff';
        }}
      >
        {uploading ? '⏳' : '🖼️'}
      </button>
    </>
  );
}