import React, { useState } from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import ImageExtension from '@tiptap/extension-image';
import { Button, Input, Modal, Space, Upload, message } from 'antd';
import { BoldOutlined, ItalicOutlined, OrderedListOutlined, UnorderedListOutlined, PictureOutlined, LinkOutlined, UndoOutlined, RedoOutlined } from '@ant-design/icons';
import { readImageFile } from '../ImageUploadField.jsx';

export function textDocument(text = '') {
  return { type: 'doc', content: text.split('\n').map((line) => ({ type: 'paragraph', ...(line ? { content: [{ type: 'text', text: line }] } : {}) })) };
}

export function RichTextEditor({ document, text, onChange, label = 'เนื้อหา' }) {
  const [link, setLink] = useState(null);
  const [, refresh] = useState(0);
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [StarterKit.configure({ heading: { levels: [2, 3] }, link: { openOnClick: false } }), ImageExtension.configure({ allowBase64: true })],
    content: document || textDocument(text),
    editorProps: { attributes: { 'aria-label': label, role: 'textbox', 'aria-multiline': 'true' } },
    onUpdate: ({ editor: current }) => onChange(current.getJSON(), current.getText()),
    onSelectionUpdate: () => refresh((value) => value + 1),
  });
  if (!editor) return null;
  const action = (title, icon, command, active) => <Button size="small" type={active ? 'primary' : 'text'} title={title} aria-label={title} aria-pressed={Boolean(active)} icon={icon} onClick={command}/>;
  return <div className="chapter-rich-editor">
    <div className="chapter-rich-toolbar" role="toolbar" aria-label="จัดรูปแบบข้อความ">
      <Button size="small" type={editor.isActive('heading', { level: 2 }) ? 'primary' : 'text'} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>หัวข้อ</Button>
      {action('ตัวหนา', <BoldOutlined/>, () => editor.chain().focus().toggleBold().run(), editor.isActive('bold'))}
      {action('ตัวเอียง', <ItalicOutlined/>, () => editor.chain().focus().toggleItalic().run(), editor.isActive('italic'))}
      {action('รายการหัวข้อ', <UnorderedListOutlined/>, () => editor.chain().focus().toggleBulletList().run(), editor.isActive('bulletList'))}
      {action('รายการลำดับเลข', <OrderedListOutlined/>, () => editor.chain().focus().toggleOrderedList().run(), editor.isActive('orderedList'))}
      {action('แทรกลิงก์', <LinkOutlined/>, () => setLink(editor.getAttributes('link').href || ''), editor.isActive('link'))}
      <Upload accept="image/png,image/jpeg,image/webp" showUploadList={false} beforeUpload={async (file) => { try { const src = await readImageFile(file); if (!editor.isDestroyed) editor.chain().focus().setImage({ src, alt: file.name }).run(); } catch (error) { message.error(error.message); } return Upload.LIST_IGNORE; }}><Button size="small" type="text" icon={<PictureOutlined/>}>รูปภาพ</Button></Upload>
      <Space className="chapter-toolbar-history" size={2}>{action('เลิกทำ', <UndoOutlined/>, () => editor.chain().focus().undo().run())}{action('ทำซ้ำ', <RedoOutlined/>, () => editor.chain().focus().redo().run())}</Space>
    </div>
    <EditorContent editor={editor}/>
    <Modal title="แทรกลิงก์" open={link !== null} onCancel={() => setLink(null)} okText="ใช้ลิงก์" cancelText="ยกเลิก" onOk={() => { if (!link.trim()) editor.chain().focus().unsetLink().run(); else if (/^https?:\/\//i.test(link.trim())) editor.chain().focus().extendMarkRange('link').setLink({ href: link.trim() }).run(); else { message.error('ใช้ลิงก์ที่ขึ้นต้นด้วย https:// หรือ http://'); return; } setLink(null); }}><Input aria-label="URL ลิงก์" value={link || ''} onChange={(event) => setLink(event.target.value)} placeholder="https://..."/></Modal>
  </div>;
}

// Render only supported document nodes; never inject stored HTML into the page.
export function RichDocument({ document, text }) {
  const render = (node, key) => {
    if (node.type === 'text') return (node.marks || []).reduce((value, mark) => mark.type === 'bold' ? <strong>{value}</strong> : mark.type === 'italic' ? <em>{value}</em> : mark.type === 'link' && /^https?:\/\//i.test(mark.attrs?.href) ? <a href={mark.attrs.href} target="_blank" rel="noopener noreferrer">{value}</a> : value, node.text);
    if (node.type === 'image') return /^(https?:\/\/|data:image\/(png|jpeg|webp);base64,)/i.test(node.attrs?.src || '') ? <img key={key} src={node.attrs.src} alt={node.attrs.alt || 'ภาพประกอบบทเรียน'}/> : null;
    if (node.type === 'hardBreak') return <br key={key}/>;
    const children = (node.content || []).map((child, index) => <React.Fragment key={index}>{render(child, index)}</React.Fragment>);
    const tag = { doc: 'div', paragraph: 'p', heading: node.attrs?.level === 3 ? 'h3' : 'h2', bulletList: 'ul', orderedList: 'ol', listItem: 'li', blockquote: 'blockquote', codeBlock: 'pre' }[node.type] || 'div';
    return React.createElement(tag, { key }, children);
  };
  return <div className="chapter-rich-document">{render(document || textDocument(text), 'doc')}</div>;
}
