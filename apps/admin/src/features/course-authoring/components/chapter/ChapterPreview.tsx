import React from 'react';
import { Alert, Empty, Modal, Radio, Space, Tag } from 'antd';
import { RichDocument } from '@melearn/ui';
import type { Chapter, EssayQuestion, Quiz } from '@legacy/types';

export interface ChapterPreviewProps {
  chapter: Chapter;
  quizzes: Quiz[];
  open: boolean;
  onClose: () => void;
  dirty?: boolean;
}

export function ChapterPreview({ chapter, quizzes, open, onClose, dirty = false }: ChapterPreviewProps) {
  return (
    <Modal open={open} onCancel={onClose} footer={null} width={850} title="ตัวอย่างบทเรียน" className="chapter-preview-modal">
      <Alert
        type="info"
        showIcon
        message={dirty ? 'ตัวอย่างจากงานที่กำลังแก้ — ยังไม่ได้บันทึก' : 'ตัวอย่างเนื้อหาที่บันทึกแล้ว'}
        description="ตัวอย่างสำหรับตรวจเนื้อหา ไม่ส่งคำตอบหรือบันทึกผลการเรียน"
      />
      <h1>{chapter.title}</h1>
      <p>{chapter.description}</p>
      {!chapter.items.length && <Empty description="ยังไม่มีเนื้อหาในบท" />}
      {chapter.items.map((item, index) => (
        <section className="chapter-preview-item" key={item.id}>
          <Space>
            <Tag>{index + 1}</Tag>
            <span>{item.type === 'video' ? 'วิดีโอ' : item.type === 'article' ? 'บทอ่าน' : 'แบบฝึกหัด'}</span>
          </Space>
          <h2>{item.title}</h2>
          {item.type === 'video' && (
            <>
              {/^(https?:\/\/|data:video\/(mp4|webm);base64,)/i.test(item.videoUrl || '') ? (
                <video controls src={item.videoUrl} className="chapter-video-preview" />
              ) : (
                <Empty description="ยังไม่ได้เลือกวิดีโอ" />
              )}
              <p>{item.description}</p>
            </>
          )}
          {item.type === 'article' && <RichDocument document={item.articleDoc} text={item.articleBody} />}
          {item.type === 'quiz' &&
            quizzes
              .find((quiz) => quiz.id === item.quizId)
              ?.questions.map((question, number) => (
                <div className="chapter-preview-question" key={question.id}>
                  <strong>
                    ข้อ {number + 1} · {question.points} คะแนน
                  </strong>
                  <RichDocument document={question.promptDoc} text={question.prompt} />
                  {question.type === 'choice' ? (
                    <Radio.Group>
                      <Space direction="vertical">
                        {question.options.map((option, i) => (
                          <Radio key={i} value={i}>
                            {option}
                          </Radio>
                        ))}
                      </Space>
                    </Radio.Group>
                  ) : (
                    <div className="chapter-answer-placeholder">
                      {(question as EssayQuestion).responseMode === 'text'
                        ? 'พื้นที่เขียนคำตอบ'
                        : (question as EssayQuestion).responseMode === 'image'
                          ? 'พื้นที่แนบภาพคำตอบ'
                          : 'พื้นที่เขียนคำตอบและแนบภาพ'}
                    </div>
                  )}
                </div>
              ))}
        </section>
      ))}
    </Modal>
  );
}
