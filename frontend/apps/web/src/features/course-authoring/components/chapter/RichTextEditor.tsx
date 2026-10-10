import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Mark } from '@tiptap/core';
import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import { EditorContent, NodeViewWrapper, ReactNodeViewRenderer, useEditor, type NodeViewProps, type JSONContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import ImageExtension, { type SetImageOptions } from '@tiptap/extension-image';
import { Button, Input, Modal, Space, Upload, message } from 'antd';
import {
  BoldOutlined,
  HighlightOutlined,
  ItalicOutlined,
  OrderedListOutlined,
  UnorderedListOutlined,
  PictureOutlined,
  LinkOutlined,
  UndoOutlined,
  RedoOutlined,
} from '@ant-design/icons';
import type { RcFile } from 'antd/es/upload';
import { textDocument, type RichTextNode } from '@melearn/ui';
import { readImageFile } from '@melearn/ui';

const imageTypes = ['image/png', 'image/jpeg', 'image/webp'];
const aligns = [
  { value: 'left', label: 'ซ้าย' },
  { value: 'center', label: 'กลาง' },
  { value: 'right', label: 'ขวา' },
  { value: 'wide', label: 'กว้าง' },
];

const HighlightMark = Mark.create({
  name: 'highlight',
  parseHTML() {
    return [{ tag: 'mark' }];
  },
  renderHTML() {
    return ['mark', { class: 'text-highlight' }, 0];
  },
});

function imageFilesFrom(data: DataTransfer | null): File[] {
  const direct = [...(data?.files || [])].filter((file) => imageTypes.includes(file.type));
  if (direct.length) return direct;
  return [...(data?.items || [])]
    .map((item) => (item.kind === 'file' ? item.getAsFile() : null))
    .filter((file): file is File => Boolean(file && imageTypes.includes(file.type)));
}

function ArticleImageView({ node, selected, updateAttributes, deleteNode }: NodeViewProps) {
  const align = aligns.some((item) => item.value === node.attrs.align) ? node.attrs.align : 'center';
  return (
    <NodeViewWrapper className={`blog-editor-figure is-${align}${selected ? ' is-selected' : ''}`} data-align={align}>
      {selected && (
        <div
          className="blog-editor-figure-bar"
          role="toolbar"
          aria-label="จัดตำแหน่งรูป"
          onMouseDown={(event) => event.preventDefault()}
        >
          {aligns.map((item) => (
            <Button
              key={item.value}
              size="small"
              type={align === item.value ? 'primary' : 'default'}
              aria-pressed={align === item.value}
              onClick={() => updateAttributes({ align: item.value })}
            >
              {item.label}
            </Button>
          ))}
          <Button size="small" danger onClick={deleteNode}>
            นำรูปออก
          </Button>
        </div>
      )}
      <img src={node.attrs.src} alt={node.attrs.alt || 'ภาพประกอบ'} />
    </NodeViewWrapper>
  );
}

interface CustomImageOptions {
  inline: boolean;
  allowBase64: boolean;
  HTMLAttributes: Record<string, unknown>;
  resize: boolean | { enabled: boolean };
  articleLayout: boolean;
}

const ArticleImage = ImageExtension.extend<CustomImageOptions>({
  addOptions() {
    const parentOptions = this.parent?.();
    return {
      inline: false,
      allowBase64: false,
      HTMLAttributes: {},
      resize: false,
      ...parentOptions,
      articleLayout: false,
    };
  },
  addAttributes() {
    return {
      ...this.parent?.(),
      align: {
        default: 'center',
        parseHTML: (element) => element.getAttribute('data-align') || 'center',
        renderHTML: (attributes) => ({ 'data-align': attributes.align || 'center' }),
      },
    };
  },
  addNodeView() {
    if (!this.options.articleLayout) return null;
    return ReactNodeViewRenderer(ArticleImageView);
  },
});

export interface RichTextEditorProps {
  document?: unknown;
  text?: string;
  onChange: (doc: JSONContent, text: string) => void;
  label?: string;
  article?: boolean;
}

export function RichTextEditor({
  document,
  text,
  onChange,
  label = 'เนื้อหา',
  article = false,
}: RichTextEditorProps) {
  const [link, setLink] = useState<string | null>(null);
  const [, refresh] = useState(0);
  const editorRef = useRef<ReturnType<typeof useEditor>>(null);
  const extensions = useMemo(
    () => [
      StarterKit.configure({ heading: { levels: [2, 3] }, link: { openOnClick: false } }),
      HighlightMark,
      ArticleImage.configure({ allowBase64: true, articleLayout: article }),
    ],
    [article]
  );
  const placeImages = async (files: File[]) => {
    const current = editorRef.current;
    if (!current || !files.length) return;
    for (const file of files) {
      try {
        const src = await readImageFile(file);
        if (!current.isDestroyed) {
          const image: SetImageOptions & { align: 'center' } = {
            src, alt: file.name.replace(/\.[^.]+$/, ''), align: 'center',
          };
          current
            .chain()
            .focus()
            .setImage(image)
            .run();
        }
      } catch (error: unknown) {
        if (error instanceof Error) {
          message.error(error.message);
        }
      }
    }
  };
  const editor = useEditor({
    immediatelyRender: false,
    extensions,
    content: (document as RichTextNode) || textDocument(text),
    editorProps: {
      attributes: { 'aria-label': label, role: 'textbox', 'aria-multiline': 'true' },
      handlePaste(_view, event) {
        const files = imageFilesFrom(event.clipboardData);
        if (!files.length) return false;
        event.preventDefault();
        placeImages(files);
        return true;
      },
      handleDrop(_view, event) {
        const files = imageFilesFrom(event.dataTransfer);
        if (!files.length) return false;
        event.preventDefault();
        placeImages(files);
        return true;
      },
    },
    onUpdate: ({ editor: current }) => onChange(current.getJSON(), current.getText()),
    onSelectionUpdate: () => refresh((value: number) => value + 1),
  });
  editorRef.current = editor;
  const documentSeedRef = useRef('');
  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    const next = document || textDocument(text);
    const serialized = JSON.stringify(next);
    if (documentSeedRef.current === serialized) return;
    if (JSON.stringify(editor.getJSON()) !== serialized) {
      editor.commands.setContent(next as RichTextNode, { emitUpdate: false });
    }
    documentSeedRef.current = serialized;
  }, [document, text, editor]);
  if (!editor) return null;

  const action = (title: string, icon: React.ReactNode, command: () => void, active?: boolean) => (
    <Button
      size="small"
      type={active ? 'primary' : 'text'}
      title={title}
      aria-label={title}
      aria-pressed={Boolean(active)}
      icon={icon}
      onClick={command}
    />
  );
  const addImage = async (file: RcFile) => {
    try {
      const src = await readImageFile(file);
      if (!editor.isDestroyed) {
        const image: SetImageOptions & { align: 'center' } = {
          src, alt: file.name.replace(/\.[^.]+$/, ''), align: 'center',
        };
        editor
          .chain()
          .focus()
          .setImage(image)
          .run();
      }
    } catch (error: unknown) {
      if (error instanceof Error) {
        message.error(error.message);
      }
    }
    return Upload.LIST_IGNORE;
  };
  return (
    <div className={`chapter-rich-editor${article ? ' blog-rich-editor' : ''}`}>
      <div className="chapter-rich-toolbar" role="toolbar" aria-label="จัดรูปแบบข้อความ">
        <Button
          size="small"
          type={editor.isActive('heading', { level: 2 }) ? 'primary' : 'text'}
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        >
          หัวข้อ
        </Button>
        {action('ตัวหนา', <BoldOutlined />, () => editor.chain().focus().toggleBold().run(), editor.isActive('bold'))}
        {action('ตัวเอียง', <ItalicOutlined />, () => editor.chain().focus().toggleItalic().run(), editor.isActive('italic'))}
        {article && (
          <Button
            size="small"
            type={editor.isActive('highlight') ? 'primary' : 'text'}
            icon={<HighlightOutlined />}
            aria-pressed={editor.isActive('highlight')}
            onClick={() => editor.chain().focus().toggleMark('highlight').run()}
          >
            ไฮไลต์
          </Button>
        )}
        {action(
          'รายการหัวข้อ',
          <UnorderedListOutlined />,
          () => editor.chain().focus().toggleBulletList().run(),
          editor.isActive('bulletList')
        )}
        {action(
          'รายการลำดับเลข',
          <OrderedListOutlined />,
          () => editor.chain().focus().toggleOrderedList().run(),
          editor.isActive('orderedList')
        )}
        {action(
          'แทรกลิงก์',
          <LinkOutlined />,
          () => setLink(editor.getAttributes('link').href || ''),
          editor.isActive('link')
        )}
        <Upload accept="image/png,image/jpeg,image/webp" showUploadList={false} beforeUpload={addImage}>
          <Button size="small" type="text" icon={<PictureOutlined />}>
            รูปภาพ
          </Button>
        </Upload>
        <Space className="chapter-toolbar-history" size={2}>
          {action('เลิกทำ', <UndoOutlined />, () => editor.chain().focus().undo().run())}
          {action('ทำซ้ำ', <RedoOutlined />, () => editor.chain().focus().redo().run())}
        </Space>
      </div>
      <EditorContent editor={editor} />
      <Modal
        title="แทรกลิงก์"
        open={link !== null}
        onCancel={() => setLink(null)}
        okText="ใช้ลิงก์"
        cancelText="ยกเลิก"
        onOk={() => {
          if (!link?.trim()) {
            editor.chain().focus().unsetLink().run();
          } else if (/^https?:\/\//i.test(link.trim())) {
            editor.chain().focus().extendMarkRange('link').setLink({ href: link.trim() }).run();
          } else {
            message.error('ใช้ลิงก์ที่ขึ้นต้นด้วย https:// หรือ http://');
            return;
          }
          setLink(null);
        }}
      >
        <Input
          aria-label="URL ลิงก์"
          value={link || ''}
          onChange={(event) => setLink(event.target.value)}
          placeholder="https://..."
        />
      </Modal>
    </div>
  );
}
