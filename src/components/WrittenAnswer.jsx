import React, { useRef, useState } from 'react';
import { Button, Image, Input, Upload, message } from 'antd';
import { DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { readImageFile } from './ImageUploadField.jsx';

export const writtenAnswer = (value) => typeof value === 'string' ? { text: value, images: [] } : { text: value?.text ?? '', images: value?.images ?? [] };
export function answerIsComplete(question, value) {
  const answer = writtenAnswer(value);
  const mode = question.responseMode ?? 'either';
  return mode === 'text' ? Boolean(answer.text.trim()) : mode === 'image' ? answer.images.length > 0 : Boolean(answer.text.trim() || answer.images.length);
}

export function WrittenAnswerInput({ value, onChange, mode = 'either' }) {
  const answer = writtenAnswer(value);
  const latest = useRef(answer);
  latest.current = answer;
  const [loading, setLoading] = useState(false);
  const upload = async (file) => {
    if (latest.current.images.length >= 3) { message.info('แนบภาพได้สูงสุด 3 ภาพต่อข้อ'); return Upload.LIST_IGNORE; }
    setLoading(true);
    try {
      const url = await readImageFile(file);
      const next = { ...latest.current, images: [...latest.current.images, { id: crypto.randomUUID(), name: file.name, url }] };
      latest.current = next;
      onChange?.(next);
    } catch (error) { message.error(error.message); }
    finally { setLoading(false); }
    return Upload.LIST_IGNORE;
  };
  return <div className="written-answer-input">
    {mode !== 'image' && <Input.TextArea aria-label="คำตอบข้อเขียน" rows={5} maxLength={3000} showCount placeholder={mode === 'either' ? 'พิมพ์คำตอบ หรือแนบภาพงานด้านล่าง' : 'เขียนคำตอบพร้อมเหตุผลประกอบ'} value={answer.text} onChange={(event) => onChange?.({ ...answer, text: event.target.value })} />}
    {mode !== 'text' && <div className="answer-attachments">
      <Image.PreviewGroup>{answer.images.map((file) => <div className="answer-image" key={file.id}><Image src={file.url} alt={file.name} /><Button size="small" icon={<DeleteOutlined />} aria-label={`ลบภาพ ${file.name}`} onClick={() => onChange?.({ ...answer, images: answer.images.filter((item) => item.id !== file.id) })} /><span>{file.name}</span></div>)}</Image.PreviewGroup>
      <Upload accept="image/png,image/jpeg,image/webp" showUploadList={false} beforeUpload={upload} disabled={loading || answer.images.length >= 3}><Button icon={<PlusOutlined />} loading={loading} disabled={answer.images.length >= 3}>แนบภาพงาน</Button></Upload>
      <small>แนบได้ 3 ภาพ · JPG, PNG, WebP · ภาพละไม่เกิน 5 MB</small>
    </div>}
  </div>;
}

export function WrittenAnswerView({ value }) {
  const answer = writtenAnswer(value);
  return <div className="written-answer-view">{answer.text && <p>{answer.text}</p>}{answer.images.length > 0 && <div className="answer-image-gallery"><Image.PreviewGroup>{answer.images.map((file) => <Image key={file.id} src={file.url} alt={file.name} />)}</Image.PreviewGroup></div>}{!answer.text && !answer.images.length && <p>ยังไม่มีคำตอบ</p>}</div>;
}
