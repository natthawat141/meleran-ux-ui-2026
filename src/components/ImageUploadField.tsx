import React, { useState } from 'react';
import { Button, Upload, message } from 'antd';
import { DeleteOutlined, UploadOutlined } from '@ant-design/icons';
import type { RcFile } from 'antd/es/upload';

// Keep browser-stored images small enough for the prototype's local persistence.
export async function readImageFile(file: File | Blob): Promise<string> {
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) throw new Error('เลือกไฟล์ JPG, PNG หรือ WebP');
  if (file.size > 5 * 1024 * 1024) throw new Error('เลือกภาพขนาดไม่เกิน 5 MB');
  const source = URL.createObjectURL(file);
  try {
    const image = new window.Image();
    image.src = source;
    await image.decode();
    const scale = Math.min(1, 1400 / Math.max(image.width, image.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.width * scale));
    canvas.height = Math.max(1, Math.round(image.height * scale));
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('อ่านภาพไม่สำเร็จ');
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/webp', 0.84);
  } catch {
    throw new Error('อ่านภาพไม่สำเร็จ ลองเลือกไฟล์ใหม่');
  } finally {
    URL.revokeObjectURL(source);
  }
}

export interface ImageUploadFieldProps {
  value?: string;
  onChange?: (val?: string) => void;
  fallback?: string;
  avatar?: boolean;
  wide?: boolean;
}

export function ImageUploadField({ value, onChange, fallback, avatar = false, wide = false }: ImageUploadFieldProps) {
  const [loading, setLoading] = useState(false);
  const [filename, setFilename] = useState('');
  const source = typeof value === 'string' && value.trim() ? value.trim() : fallback;
  const select = async (file: RcFile) => {
    setLoading(true);
    try {
      onChange?.(await readImageFile(file));
      setFilename(file.name);
    } catch (error: unknown) {
      if (error instanceof Error) {
        message.error(error.message);
      }
    } finally {
      setLoading(false);
    }
    return Upload.LIST_IGNORE;
  };
  return (
    <div className={`image-upload-field${avatar ? ' image-upload-avatar' : ''}${wide ? ' image-upload-wide' : ''}`}>
      <div className="image-upload-preview">
        {source ? (
          <img className="image-upload-preview-img" src={source} alt={avatar ? 'รูปโปรไฟล์' : 'ภาพปก'} />
        ) : (
          <span>{avatar ? 'รูปโปรไฟล์' : 'ยังไม่มีภาพปก'}</span>
        )}
      </div>
      <div className="image-upload-controls">
        <Upload accept="image/png,image/jpeg,image/webp" showUploadList={false} beforeUpload={select} disabled={loading}>
          <Button icon={<UploadOutlined />} loading={loading}>
            {source ? 'เปลี่ยนรูป' : 'อัปโหลดรูป'}
          </Button>
        </Upload>
        {typeof value === 'string' && value.trim() && (
          <Button
            type="text"
            icon={<DeleteOutlined />}
            aria-label="นำรูปที่เลือกออก"
            onClick={() => {
              onChange?.(undefined);
              setFilename('');
            }}
          />
        )}
      </div>
      <p className="image-upload-hint">{filename || 'JPG, PNG, WebP · ไม่เกิน 5 MB'}</p>
      {!avatar && <p className="image-upload-hint">ภาพแนวนอน 16:9 จะแสดงได้พอดีที่สุด</p>}
    </div>
  );
}
