import React, { useState } from 'react';
import { Button, Upload, message } from 'antd';
import { DeleteOutlined, UploadOutlined } from '@ant-design/icons';
import type { RcFile } from 'antd/es/upload';

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
  };
  return (
    <div className={`image-upload-field${avatar ? ' image-upload-avatar' : ''}${wide ? ' image-upload-wide' : ''}`}>
      <div className="image-upload-preview">
        {source ? (
          <img className="image-upload-preview-img" src={source} alt={avatar ? 'รูปโปรไฟล์' : 'ภาพปก'} />
        ) : (
          <div className="image-upload-empty">{avatar ? 'ไม่มีรูป' : 'ไม่มีภาพปก'}</div>
        )}
      </div>
      <div className="image-upload-actions">
        <Upload accept="image/png,image/jpeg,image/webp" showUploadList={false} beforeUpload={select}>
          <Button icon={<UploadOutlined />} loading={loading}>
            {value ? 'เปลี่ยนรูป' : 'เลือกรูป'}
          </Button>
        </Upload>
        {value && (
          <Button
            danger
            type="text"
            icon={<DeleteOutlined />}
            onClick={() => {
              onChange?.('');
              setFilename('');
            }}
          >
            ลบ
          </Button>
        )}
        {filename && <span className="image-upload-filename">{filename}</span>}
      </div>
    </div>
  );
}
