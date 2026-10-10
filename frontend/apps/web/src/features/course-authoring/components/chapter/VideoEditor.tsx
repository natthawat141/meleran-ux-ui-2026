import React, { useState } from 'react';
import { Alert, Input, Segmented } from 'antd';
import { youtubeEmbedUrl, normalizeYoutubeUrl } from '@melearn/course-authoring';
import type { VideoItem } from '@melearn/contracts';

export interface VideoEditorProps {
  item: VideoItem;
  onChange: (patch: Partial<VideoItem>) => void;
}

export function VideoEditor({ item, onChange }: VideoEditorProps) {
  const [mode, setMode] = useState<'link' | 'file'>(item.videoUrl?.startsWith('data:') ? 'file' : 'link');
  const embedUrl = youtubeEmbedUrl(item.videoUrl);
  const updateUrl = (values: Partial<VideoItem>) => {
    onChange(values);
  };

  return (
    <div className="chapter-field-stack">
      <Segmented
        value={mode}
        onChange={(val) => setMode(val as 'link' | 'file')}
        options={[
          { label: 'ใส่ลิงก์ YouTube', value: 'link' },
          { label: 'อัปโหลดวิดีโอ', value: 'file' },
        ]}
      />
      {mode === 'link' ? (
        <label>
          ลิงก์ YouTube
          <Input
            value={item.videoUrl || ''}
            onChange={(event) => updateUrl({ videoUrl: normalizeYoutubeUrl(event.target.value), videoFilename: '' })}
            placeholder="https://www.youtube.com/watch?v=..."
          />
          <small>รองรับลิงก์ youtube.com/watch, youtu.be และ YouTube Shorts</small>
        </label>
      ) : (
        <div className="chapter-video-upload">
          <Alert type="info" showIcon message="ขออภัย ระบบนี้ยังไม่พร้อมใช้งาน" description="ใช้ลิงก์ YouTube สำหรับวิดีโอในตอนนี้" />
        </div>
      )}
      {embedUrl && <iframe title={item.title || 'ตัวอย่างวิดีโอ YouTube'} src={embedUrl} className="chapter-video-preview" style={{ width: '100%', aspectRatio: '16 / 9', border: 0 }} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />}
      {item.videoUrl && !embedUrl && <Alert type="warning" showIcon message="กรอกลิงก์ YouTube ที่ถูกต้อง" />}
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
