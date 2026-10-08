import React from 'react';

export interface RichTextNode {
  type: string;
  text?: string;
  marks?: Array<{ type: string; attrs?: { href?: string } }>;
  attrs?: { level?: number; src?: string; alt?: string; align?: string; href?: string };
  content?: RichTextNode[];
}

export function textDocument(text = ''): RichTextNode {
  return {
    type: 'doc',
    content: text
      .split('\n')
      .map((line) => ({ type: 'paragraph', ...(line ? { content: [{ type: 'text', text: line }] } : {}) })),
  };
}

const aligns = [
  { value: 'left', label: 'ซ้าย' },
  { value: 'center', label: 'กลาง' },
  { value: 'right', label: 'ขวา' },
  { value: 'wide', label: 'กว้าง' },
];

export interface RichDocumentProps {
  document?: unknown;
  text?: string;
}

// Render only supported document nodes; never inject stored HTML into the page.
export function RichDocument({ document, text }: RichDocumentProps) {
  const render = (node: RichTextNode | null | undefined, key: React.Key): React.ReactNode => {
    if (!node) return null;
    if (node.type === 'text') {
      return (node.marks || []).reduce<React.ReactNode>(
        (value, mark) =>
          mark.type === 'bold' ? (
            <strong>{value}</strong>
          ) : mark.type === 'italic' ? (
            <em>{value}</em>
          ) : mark.type === 'highlight' ? (
            <mark className="text-highlight">{value}</mark>
          ) : mark.type === 'link' && /^https?:\/\//i.test(mark.attrs?.href || '') ? (
            <a href={mark.attrs?.href} target="_blank" rel="noopener noreferrer">
              {value}
            </a>
          ) : (
            value
          ),
        node.text
      );
    }
    if (node.type === 'image') {
      if (!/^(https?:\/\/|data:image\/(png|jpeg|webp);base64,)/i.test(node.attrs?.src || '')) return null;
      const align = aligns.some((item) => item.value === node.attrs?.align) ? node.attrs?.align : 'center';
      return (
        <img
          key={key}
          className={`rich-figure rich-figure-${align}`}
          src={node.attrs?.src}
          alt={node.attrs?.alt || 'ภาพประกอบ'}
        />
      );
    }
    if (node.type === 'hardBreak') return <br key={key} />;
    const children = (node.content || []).map((child, index) => (
      <React.Fragment key={index}>{render(child, index)}</React.Fragment>
    ));
    const tag =
      {
        doc: 'div',
        paragraph: 'p',
        heading: node.attrs?.level === 3 ? 'h3' : 'h2',
        bulletList: 'ul',
        orderedList: 'ol',
        listItem: 'li',
        blockquote: 'blockquote',
        codeBlock: 'pre',
      }[node.type] || 'div';
    return React.createElement(tag, { key }, children);
  };
  return <div className="chapter-rich-document">{render(((document as RichTextNode) || textDocument(text)), 'doc')}</div>;
}
