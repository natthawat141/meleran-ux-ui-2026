import { useState } from 'react';
import { Button } from 'antd';
import { renderToString } from 'katex';
import 'katex/dist/katex.min.css';
import type { AiContentBlock } from './ai-chat-model';

function PracticeResponse({ block }: { block: Extract<AiContentBlock, { type: 'practice' }> }) {
  const [choice, setChoice] = useState<number | null>(null);
  const correct = choice === block.correctOption;
  return (
    <fieldset className="mai-response-practice">
      <legend>ลองเช็กความเข้าใจ</legend>
      <p>{block.prompt}</p>
      <div className="mai-practice-options">
        {block.options.map((option, index) => (
          <Button key={`${index}-${option}`} type={choice === index ? 'primary' : 'default'}
            aria-pressed={choice === index} onClick={() => setChoice(index)}>{option}</Button>
        ))}
      </div>
      {choice !== null && <p className="mai-practice-feedback" role="status" data-correct={correct}>
        {correct ? `ถูกต้อง! ${block.explanation}` : 'ยังไม่ถูก ลองแยกโจทย์เป็นขั้นตอนแล้วเลือกอีกครั้ง'}
      </p>}
    </fieldset>
  );
}

function PracticeSetResponse({
  block,
  onAnswer,
}: {
  block: Extract<AiContentBlock, { type: 'practice_set' }>;
  onAnswer: (questionId: string, answer: number) => void;
}) {
  const answered = block.answers.filter((answer) => answer !== null).length;
  const complete = answered === block.questions.length;
  const score = block.questions.reduce((total, question, index) => total + (block.answers[index] === question.correctOption ? 1 : 0), 0);
  return <section className="mai-practice-set" aria-label={`แบบฝึกหัด ${block.topic}`}>
    <div className="mai-practice-set-heading">
      <div><strong>{`ฝึกเรื่อง${block.topic}`}</strong><span>เลือกคำตอบได้ใหม่จนกว่าจะพอใจ</span></div>
      <span>{`${answered}/${block.questions.length} ข้อ`}</span>
    </div>
    {block.questions.map((question, index) => {
      const selected = block.answers[index];
      const correct = selected === question.correctOption;
      return <fieldset className="mai-practice-set-question" key={question.id}>
        <legend>{`ข้อ ${index + 1}`}</legend>
        <p>{question.prompt}</p>
        <div className="mai-practice-set-options" role="group" aria-label={`ตัวเลือกข้อ ${index + 1}`}>
          {question.options.map((option, optionIndex) => <Button
            key={option}
            type={selected === optionIndex && correct ? 'primary' : 'default'}
            aria-pressed={selected === optionIndex}
            data-selected={selected === optionIndex}
            data-correct={selected === optionIndex ? correct : undefined}
            onClick={() => onAnswer(question.id, optionIndex)}
          >{option}</Button>)}
        </div>
        {selected !== null && <div className="mai-practice-set-feedback" role="status" data-correct={correct}>
          <strong>{correct ? 'ตอบถูก' : 'ยังไม่ถูก ลองเลือกใหม่ได้'}</strong>
          <p>{question.explanation}</p>
          {complete && !correct && <p>{`คำตอบคือ ${question.options[question.correctOption]}`}</p>}
        </div>}
      </fieldset>;
    })}
    {complete && <div className="mai-practice-set-result" role="status">
      {`ผลล่าสุด ${score} จาก ${block.questions.length} ข้อ`}
    </div>}
    <p className="mai-practice-set-source">{block.sourceLabel} · การฝึกนี้ไม่เปลี่ยนคะแนนหรือความคืบหน้าคอร์ส</p>
  </section>;
}

function MathResponse({ latex }: { latex: string }) {
  const html = renderToString(latex, {
    displayMode: true, output: 'htmlAndMathml', throwOnError: false,
    trust: false, maxExpand: 1000, maxSize: 10,
  });
  // Only KaTeX's generated markup is rendered as HTML, never raw model HTML.
  return <div className="mai-response-math" dangerouslySetInnerHTML={{ __html: html }} />;
}

export function AiResponse({ blocks, onPracticeAnswer }: { blocks: AiContentBlock[]; onPracticeAnswer?: (questionId: string, answer: number) => void }) {
  return <div className="mai-response">
    {blocks.map((block, index) => {
      if (block.type === 'math') return <MathResponse key={index} latex={block.latex} />;
      if (block.type === 'practice') return <PracticeResponse key={index} block={block} />;
      if (block.type === 'practice_set') return <PracticeSetResponse key={block.id} block={block} onAnswer={onPracticeAnswer ?? (() => {})} />;
      if (block.type === 'practice_notice') return <p className="mai-response-text mai-practice-notice" key={block.id} role="status">{block.message}</p>;
      return <p className="mai-response-text" key={index}>{block.text}</p>;
    })}
  </div>;
}
