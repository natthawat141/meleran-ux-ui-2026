import React, { useState } from 'react';
import { Button, Image, Upload, message } from 'antd';
import { DeleteOutlined, UploadOutlined } from '@ant-design/icons';

// Keep browser-stored images small enough for the prototype's local persistence.
export async function readImageFile(file) {
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
    canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/webp', .84);
  } catch { throw new Error('อ่านภาพไม่สำเร็จ ลองเลือกไฟล์ใหม่'); }
  finally { URL.revokeObjectURL(source); }
}

export function ImageUploadField({ value, onChange, fallback, avatar = false }) {
  const [loading, setLoading] = useState(false);
  const [filename, setFilename] = useState('');
  const source = value || fallback;
  const select = async (file) => {
    setLoading(true);
    try { onChange?.(await readImageFile(file)); setFilename(file.name); }
    catch (error) { message.error(error.message); }
    finally { setLoading(false); }
    return Upload.LIST_IGNORE;
  };
  return <div className={`image-upload-field${avatar ? ' image-upload-avatar' : ''}`}>
    <div className="image-upload-preview">{source ? <Image src={source} alt={avatar ? 'รูปโปรไฟล์' : 'ภาพปก'} /> : <span>{avatar ? 'รูปโปรไฟล์' : 'ยังไม่มีภาพปก'}</span>}</div>
    <div className="image-upload-controls">
      <Upload accept="image/png,image/jpeg,image/webp" showUploadList={false} beforeUpload={select} disabled={loading}>
        <Button icon={<UploadOutlined />} loading={loading}>{source ? 'เปลี่ยนรูป' : 'อัปโหลดรูป'}</Button>
      </Upload>
      {value && <Button type="text" icon={<DeleteOutlined />} aria-label="นำรูปที่เลือกออก" onClick={() => { onChange?.(''); setFilename(''); }} />}
    </div>
    <p className="image-upload-hint">{filename || 'JPG, PNG, WebP · ไม่เกิน 5 MB'}</p>
    {!avatar && <p className="image-upload-hint">ภาพแนวนอน 16:9 จะแสดงได้พอดีที่สุด</p>}
  </div>;
}
