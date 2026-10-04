import React, { useState } from 'react';
import { Alert, Button, Input, Segmented, Upload, message } from 'antd';
import { UploadOutlined } from '@ant-design/icons';
import type { RcFile } from 'antd/es/upload';
import type { VideoItem } from '../../types';

export interface VideoEditorProps {
  item: VideoItem;
  onChange: (patch: Partial<VideoItem>) => void;
}

export function VideoEditor({ item, onChange }: VideoEditorProps) {
  const [mode, setMode] = useState<'link' | 'file'>(item.videoUrl?.startsWith('data:') ? 'file' : 'link');
  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(false);
  const updateUrl = (values: Partial<VideoItem>) => {
    setFailed(false);
    onChange(values);
  };

  return (
    <div className="chapter-field-stack">
      <Segmented
        value={mode}
        onChange={(val) => setMode(val as 'link' | 'file')}
        options={[
          { label: 'ใส่ลิงก์วิดีโอ', value: 'link' },
          { label: 'อัปโหลดไฟล์ทดลอง', value: 'file' },
        ]}
      />
      {mode === 'link' ? (
        <label>
          ลิงก์ไฟล์วิดีโอ
          <Input
            value={item.videoUrl || ''}
            onChange={(event) => updateUrl({ videoUrl: event.target.value, videoFilename: '' })}
            placeholder="https://example.com/lesson.mp4"
          />
          <small>ใช้ลิงก์ไฟล์ MP4 / WebM โดยตรง ไม่ใช่ลิงก์หน้าวิดีโอ YouTube</small>
        </label>
      ) : (
        <div className="chapter-video-upload">
          <Upload
            accept="video/mp4,video/webm"
            showUploadList={false}
            beforeUpload={async (file: RcFile) => {
              if (!['video/mp4', 'video/webm'].includes(file.type) || file.size > 2 * 1024 * 1024) {
                message.error('ต้นแบบรับ MP4 / WebM ไม่เกิน 2 MB ใช้ลิงก์สำหรับไฟล์ใหญ่');
                return Upload.LIST_IGNORE;
              }
              setLoading(true);
              try {
                const url = await new Promise<string>((resolve, reject) => {
                  const reader = new FileReader();
                  reader.onload = () => resolve(reader.result as string);
                  reader.onerror = reject;
                  reader.readAsDataURL(file);
                });
                updateUrl({ videoUrl: url, videoFilename: file.name });
              } catch {
                message.error('อ่านไฟล์ไม่สำเร็จ');
              } finally {
                setLoading(false);
              }
              return Upload.LIST_IGNORE;
            }}
          >
            <Button icon={<UploadOutlined />} loading={loading}>
              {item.videoFilename ? 'เปลี่ยนไฟล์' : 'เลือกไฟล์วิดีโอ'}
            </Button>
          </Upload>
          <p>{item.videoFilename || 'MP4 / WebM · สูงสุด 2 MB สำหรับทดลอง'}</p>
          <small>เก็บในเบราว์เซอร์เมื่อบันทึก ยังไม่ส่งขึ้นเซิร์ฟเวอร์</small>
        </div>
      )}
      {item.videoUrl && /^(https?:\/\/|data:video\/(mp4|webm);base64,)/i.test(item.videoUrl) && (
        <video
          key={item.videoUrl}
          controls
          preload="metadata"
          className="chapter-video-preview"
          src={item.videoUrl}
          onError={() => setFailed(true)}
        />
      )}
      {failed && <Alert type="warning" showIcon message="เปิดวิดีโอไม่ได้ ตรวจว่าลิงก์เป็นไฟล์วิดีโอที่เข้าถึงได้" />}
      <label>
        คำอธิบายวิดีโอ
        <Input.TextArea
          rows={3}
          value={item.description || ''}
          onChange={(event) => onChange({ description: event.target.value })}
          placeholder="ผู้เรียนจะได้เรียนรู้อะไรจากวิดีโอนี้"
        />
      </label>
      <label>
        ความยาวโดยประมาณ
        <Input
          value={item.duration || ''}
          onChange={(event) => onChange({ duration: event.target.value })}
          placeholder="เช่น 08:20"
        />
      </label>
    </div>
  );
}
