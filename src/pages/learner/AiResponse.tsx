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

function MathResponse({ latex }: { latex: string }) {
  const html = renderToString(latex, {
    displayMode: true, output: 'htmlAndMathml', throwOnError: false,
    trust: false, maxExpand: 1000, maxSize: 10,
  });
  // Only KaTeX's generated markup is rendered as HTML, never raw model HTML.
  return <div className="mai-response-math" dangerouslySetInnerHTML={{ __html: html }} />;
}

export function AiResponse({ blocks }: { blocks: AiContentBlock[] }) {
  return <div className="mai-response">
    {blocks.map((block, index) => {
      if (block.type === 'math') return <MathResponse key={index} latex={block.latex} />;
      if (block.type === 'practice') return <PracticeResponse key={index} block={block} />;
      return <p className="mai-response-text" key={index}>{block.text}</p>;
    })}
  </div>;
}
