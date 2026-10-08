import React, { useState } from 'react';
import { Alert, Button, Input, InputNumber, Modal, Radio, Select, Space } from 'antd';
import { PlusOutlined, CopyOutlined, ArrowUpOutlined, ArrowDownOutlined, DeleteOutlined } from '@ant-design/icons';
import { createId } from '@melearn/ui';
import { RichTextEditor } from './RichTextEditor';
import type { ChoiceQuestion, EssayQuestion, Question, Quiz } from '@melearn/contracts';

export const newQuestion = (): ChoiceQuestion => ({
  id: createId('q'),
  type: 'choice',
  prompt: '',
  points: 1,
  options: ['', ''],
  answer: 0,
});

export interface AssessmentEditorProps {
  quiz: Quiz;
  onChange: (patch: Partial<Quiz>) => void;
  locked?: boolean;
}

export function AssessmentEditor({ quiz, onChange, locked = false }: AssessmentEditorProps) {
  const [selected, setSelected] = useState<string | undefined>(quiz.questions[0]?.id);
  const question = quiz.questions.find((entry) => entry.id === selected) || quiz.questions[0];
  const index = question ? quiz.questions.indexOf(question) : -1;
  const update = (values: Partial<Question>) => {
    if (!question) return;
    onChange({
      questions: quiz.questions.map((entry) => (entry.id === question.id ? ({ ...entry, ...values } as Question) : entry)),
    });
  };
  const move = (offset: number) => {
    if (index === -1) return;
    const questions = [...quiz.questions];
    [questions[index], questions[index + offset]] = [questions[index + offset], questions[index]];
    onChange({ questions });
  };

  return (
    <div className="chapter-field-stack">
      <label>
        คะแนนผ่าน (%)
        <InputNumber
          disabled
          min={1}
          max={100}
          value={70}
          onChange={(value) => onChange({ passPercent: value ?? 70 })}
        />
      </label>
      {locked && (
        <Alert
          type="info"
          showIcon
          message="มีประวัติการทำแบบฝึกหัดแล้ว"
          description="ต้นแบบยังไม่มีเวอร์ชันข้อสอบ จึงล็อกการแก้ชุดนี้เพื่อรักษาผลเดิม ให้เพิ่มแบบฝึกหัดชุดใหม่แทน"
        />
      )}
      <fieldset disabled={locked} className="chapter-question-fieldset">
        <div className="chapter-question-tabs">
          {quiz.questions.map((entry, number) => (
            <Button
              key={entry.id}
              type={entry.id === question?.id ? 'primary' : 'default'}
              onClick={() => setSelected(entry.id)}
            >
              ข้อ {number + 1}
            </Button>
          ))}
          <Button
            disabled={locked}
            icon={<PlusOutlined />}
            onClick={() => {
              const entry = newQuestion();
              onChange({ questions: [...quiz.questions, entry] });
              setSelected(entry.id);
            }}
          >
            เพิ่มข้อ
          </Button>
        </div>
        {question && (
          <div className="chapter-field-stack" key={question.id}>
            <div className="chapter-question-heading">
              <h3>คำถามข้อ {index + 1}</h3>
              <Space>
                <Button
                  title="ทำสำเนาข้อ"
                  aria-label="ทำสำเนาข้อ"
                  icon={<CopyOutlined />}
                  disabled={locked}
                  onClick={() => {
                    const entry: Question = { ...structuredClone(question), id: createId('q') };
                    onChange({ questions: [...quiz.questions, entry] });
                    setSelected(entry.id);
                  }}
                />
                <Button
                  aria-label="เลื่อนคำถามขึ้น"
                  icon={<ArrowUpOutlined />}
                  disabled={locked || index === 0}
                  onClick={() => move(-1)}
                />
                <Button
                  aria-label="เลื่อนคำถามลง"
                  icon={<ArrowDownOutlined />}
                  disabled={locked || index === quiz.questions.length - 1}
                  onClick={() => move(1)}
                />
                <Button
                  aria-label="ลบคำถาม"
                  icon={<DeleteOutlined />}
                  disabled={locked}
                  onClick={() =>
                    Modal.confirm({
                      title: `นำคำถามข้อ ${index + 1} ออก?`,
                      okText: 'นำออก',
                      cancelText: 'ยกเลิก',
                      onOk: () =>
                        onChange({
                          questions: quiz.questions.filter((entry) => entry.id !== question.id),
                        }),
                    })
                  }
                />
              </Space>
            </div>
            <label>
              รูปแบบคำตอบ
              <Select
                disabled={locked}
                value={question.type === 'choice' ? 'choice' : (question as EssayQuestion).responseMode || 'either'}
                options={[
                  { value: 'choice', label: 'เลือกตอบ' },
                  { value: 'text', label: 'ข้อเขียน' },
                  { value: 'image', label: 'ส่งรูปภาพ' },
                  { value: 'either', label: 'ข้อเขียน / รูปภาพ หรือแนบทั้งสองแบบ' },
                ]}
                onChange={(value) => {
                  const change = () =>
                    update(
                      value === 'choice'
                        ? {
                            type: 'choice',
                            options: (question as ChoiceQuestion).options || ['', ''],
                            answer: (question as ChoiceQuestion).answer ?? 0,
                          }
                        : {
                            type: 'essay',
                            responseMode: value as 'text' | 'image' | 'either',
                          }
                    );
                  if (question.type === 'choice' && value !== 'choice') {
                    Modal.confirm({
                      title: 'เปลี่ยนรูปแบบคำตอบ?',
                      content: 'ตัวเลือกเดิมจะไม่ใช้ตรวจคะแนนในรูปแบบข้อเขียน/ภาพ',
                      okText: 'เปลี่ยนรูปแบบ',
                      cancelText: 'ยกเลิก',
                      onOk: change,
                    });
                  } else {
                    change();
                  }
                }}
              />
            </label>
            {!locked && (
              <div>
                <label className="chapter-field-label">โจทย์</label>
                <RichTextEditor
                  document={question.promptDoc}
                  text={question.prompt}
                  label="โจทย์คำถาม"
                  onChange={(promptDoc, prompt) => update({ promptDoc, prompt })}
                />
              </div>
            )}
            {locked && <p>{question.prompt}</p>}
            {question.type === 'choice' ? (
              <div className="chapter-field-stack">
                <label>
                  ตัวเลือก <small>เลือกวงกลมหน้าคำตอบที่ถูกต้อง</small>
                </label>
                {question.options.map((option, optionIndex) => (
                  <div className="chapter-choice" key={optionIndex}>
                    <Radio
                      aria-label={`กำหนดตัวเลือก ${optionIndex + 1} เป็นคำตอบที่ถูก`}
                      disabled={locked}
                      checked={question.answer === optionIndex}
                      onChange={() => update({ answer: optionIndex })}
                    />
                    <Input
                      disabled={locked}
                      aria-label={`ตัวเลือก ${optionIndex + 1}`}
                      value={option}
                      placeholder={`ตัวเลือก ${optionIndex + 1}`}
                      onChange={(event) =>
                        update({
                          options: question.options.map((text, i) => (i === optionIndex ? event.target.value : text)),
                        })
                      }
                    />
                    <Button
                      aria-label={`ลบตัวเลือก ${optionIndex + 1}`}
                      type="text"
                      icon={<DeleteOutlined />}
                      disabled={locked || question.options.length <= 2}
                      onClick={() =>
                        update({
                          options: question.options.filter((_, i) => i !== optionIndex),
                          answer:
                            question.answer === optionIndex
                              ? 0
                              : question.answer > optionIndex
                                ? question.answer - 1
                                : question.answer,
                        })
                      }
                    />
                  </div>
                ))}
                <Button
                  disabled={locked}
                  type="dashed"
                  onClick={() => update({ options: [...question.options, ''] })}
                >
                  เพิ่มตัวเลือก
                </Button>
              </div>
            ) : (
              <label>
                แนวตรวจ / เกณฑ์ให้คะแนน (สำหรับผู้สอน)
                <Input.TextArea
                  disabled={locked}
                  rows={3}
                  value={(question as EssayQuestion).rubric || ''}
                  onChange={(event) => update({ rubric: event.target.value })}
                  placeholder="เช่น อธิบายเหตุผลครบ 2 ประเด็น ประเด็นละ 5 คะแนน"
                />
              </label>
            )}
            <label>
              คะแนนเต็ม
              <InputNumber
                disabled={locked}
                min={1}
                max={100}
                value={question.points}
                onChange={(points) => update({ points: points ?? 1 })}
              />
            </label>
          </div>
        )}
      </fieldset>
    </div>
  );
}
