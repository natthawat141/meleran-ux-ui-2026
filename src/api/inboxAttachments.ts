import { readImageFile } from '../components/ImageUploadField';
import type { InboxAttachmentInput } from '../types';

export const MAX_INBOX_ATTACHMENTS = 3;
export const MAX_INBOX_ATTACHMENT_BYTES = 5 * 1024 * 1024;
export const MAX_INBOX_TOTAL_ATTACHMENT_BYTES = 8 * 1024 * 1024;

export interface PreparedInboxAttachment extends InboxAttachmentInput {}

export async function prepareInboxAttachment(file: File): Promise<PreparedInboxAttachment> {
  const imageTypes = ['image/png', 'image/jpeg', 'image/webp'];
  const videoTypes = ['video/mp4', 'video/webm'];
  const kind = imageTypes.includes(file.type) ? 'image' : videoTypes.includes(file.type) ? 'video' : null;

  if (!kind) throw new Error('เลือกภาพ JPG, PNG, WebP หรือวิดีโอ MP4, WebM');
  if (file.size > MAX_INBOX_ATTACHMENT_BYTES) throw new Error('ไฟล์แต่ละไฟล์ต้องมีขนาดไม่เกิน 5 MB');

  const url = kind === 'image'
    ? await readImageFile(file)
    : await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => typeof reader.result === 'string'
          ? resolve(reader.result)
          : reject(new Error('อ่านวิดีโอไม่สำเร็จ ลองเลือกไฟล์ใหม่'));
        reader.onerror = () => reject(new Error('อ่านวิดีโอไม่สำเร็จ ลองเลือกไฟล์ใหม่'));
        reader.readAsDataURL(file);
      });

  const contentType = kind === 'image'
    ? 'image/webp'
    : file.type === 'video/mp4' ? 'video/mp4' : 'video/webm';
  return { name: file.name, contentType, size: file.size, url };
}
