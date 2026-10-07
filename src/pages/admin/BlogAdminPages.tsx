import React, { useState } from 'react';
import { Button, Empty, Form, Input, Popconfirm, Segmented, Select, Space, Table, Tag, Typography, message } from 'antd';
import type { TableProps } from 'antd';
import { AppstoreOutlined, ArrowLeftOutlined, EyeOutlined, PlusOutlined, UnorderedListOutlined } from '@ant-design/icons';
import { Link, useNavigate, useParams } from 'react-router-dom';
import type { JSONContent } from '@tiptap/react';
import { useLms } from '../../store';
import { blogCoverFor } from '../../data';
import { PageTitle } from '@melearn/ui';
import { ImageUploadField } from '../../components/ImageUploadField';
import { RichDocument, RichTextEditor, textDocument } from '../../components/chapter/RichTextEditor';
import type { BlogPost } from '../../types';
import '../blog/blog.css';
import './blog-editor.css';

const { Text } = Typography;

export function AdminBlogPage() {
  const { data, removeBlogPost } = useLms();
  const [view, setView] = useState<'table' | 'card'>('table');
  const [query, setQuery] = useState('');
  const posts = [...data.blogPosts]
    .filter((post) => `${post.title} ${post.category}`.toLowerCase().includes(query.toLowerCase().trim()))
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

  const actions = (post: BlogPost) => (
    <Space wrap>
      <Link to={`/articles/${post.id}`}>
        <Button icon={<EyeOutlined />}>ดู</Button>
      </Link>
      <Link to={`/admin/articles/${post.id}/edit`}>
        <Button>แก้ไข</Button>
      </Link>
      <Popconfirm
        title="ลบบทความนี้?"
        description="การลบจะนำบทความออกจากหน้าเว็บทันที"
        okText="ลบ"
        cancelText="ยกเลิก"
        okButtonProps={{ danger: true }}
        onConfirm={() => {
          removeBlogPost(post.id);
          message.success('ลบบทความแล้ว');
        }}
      >
        <Button danger>ลบ</Button>
      </Popconfirm>
    </Space>
  );

  const columns: TableProps<BlogPost>['columns'] = [
    {
      title: 'บทความ',
      render: (_, post) => (
        <div className="table-course-name">
          <strong>{post.title}</strong>
          <Text type="secondary">
            {post.category} · อ่าน {post.readingMinutes ?? 3} นาที
          </Text>
        </div>
      ),
    },
    {
      title: 'สถานะ',
      render: (_, post) => (post.status === 'published' ? <Tag color="processing">เผยแพร่แล้ว</Tag> : <Tag>ฉบับร่าง</Tag>),
    },
    { title: 'แก้ไขล่าสุด', render: (_, post) => new Date(post.updatedAt).toLocaleDateString('th-TH') },
    { title: 'จัดการ', render: (_, post) => actions(post) },
  ];

  return (
    <>
      <PageTitle
        eyebrow="ผู้ดูแลระบบ"
        title="บทความ"
        subtitle="เขียนและเผยแพร่บทความให้ทุกคนอ่านได้โดยไม่ต้องเข้าสู่ระบบ"
        actions={
          <Link to="/admin/articles/new">
            <Button type="primary" icon={<PlusOutlined />}>
              เขียนบทความ
            </Button>
          </Link>
        }
      />
      <div className="collection-toolbar">
        <Input
          placeholder="ค้นหาบทความ"
          aria-label="ค้นหาบทความ"
          allowClear
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <Segmented
          aria-label="มุมมองบทความ"
          value={view}
          onChange={(val) => setView(val as 'table' | 'card')}
          options={[
            { value: 'table', label: 'ตาราง', icon: <UnorderedListOutlined /> },
            { value: 'card', label: 'การ์ด', icon: <AppstoreOutlined /> },
          ]}
        />
      </div>
      {view === 'table' ? (
        <Table
          rowKey="id"
          columns={columns}
          dataSource={posts}
          pagination={{ pageSize: 8 }}
          locale={{ emptyText: 'ยังไม่มีบทความที่ตรงกับคำค้น' }}
          scroll={{ x: 780 }}
        />
      ) : posts.length ? (
        <div className="admin-post-grid">
          {posts.map((post) => (
            <article className="admin-post-card" key={post.id}>
              <Link to={`/admin/articles/${post.id}/edit`}>
                <img src={post.cover || blogCoverFor(post.coverKey)} alt="" />
              </Link>
              <div>
                <Tag color={post.status === 'published' ? 'processing' : undefined}>
                  {post.status === 'published' ? 'เผยแพร่แล้ว' : 'ฉบับร่าง'}
                </Tag>
                <h2>{post.title}</h2>
                <p>
                  {post.category} · {new Date(post.updatedAt).toLocaleDateString('th-TH')}
                </p>
                {actions(post)}
              </div>
            </article>
          ))}
        </div>
      ) : (
        <Empty description="ไม่พบบทความ" />
      )}
    </>
  );
}

function hasBody(doc: JSONContent | null | undefined, text?: string | null) {
  return Boolean(text?.trim() || JSON.stringify(doc || {}).includes('"image"'));
}

interface BlogEditorFormValues {
  title: string;
  excerpt: string;
  category: string;
  coverKey?: string;
  cover?: string;
}

export function AdminBlogEditorPage() {
  const { id } = useParams<{ id?: string }>();
  const isNew = !id;
  const { data, currentUser, saveBlogPost } = useLms();
  const navigate = useNavigate();
  const [form] = Form.useForm<BlogEditorFormValues>();
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState(false);
  const [categorySearch, setCategorySearch] = useState('');
  const [bodyError, setBodyError] = useState('');
  const post = data.blogPosts.find((item) => item.id === id);
  const [loadedId, setLoadedId] = useState(id);
  const [doc, setDoc] = useState<JSONContent>(() => post?.bodyDoc || textDocument(post?.body || ''));
  const [plain, setPlain] = useState(post?.body || '');

  if (loadedId !== id) {
    setLoadedId(id);
    setDoc(post?.bodyDoc || textDocument(post?.body || ''));
    setPlain(post?.body || '');
    setPreview(false);
    setBodyError('');
    setCategorySearch('');
  }

  const coverKey = Form.useWatch('coverKey', form) ?? post?.coverKey ?? 'writing';
  const title = Form.useWatch('title', form) ?? post?.title;
  const excerpt = Form.useWatch('excerpt', form) ?? post?.excerpt;
  const cover = Form.useWatch('cover', form) ?? post?.cover;
  const category = Form.useWatch('category', form) ?? post?.category;

  if (!isNew && !post) return <Empty description="ไม่พบบทความนี้" />;
  const knownCategories = [...new Set(data.blogPosts.map((item) => item.category).filter(Boolean))];
  const typedCategory = categorySearch.trim();
  const categoryOptions = [
    ...knownCategories.map((value) => ({ value, label: value })),
    ...(typedCategory && !knownCategories.includes(typedCategory) ? [{ value: typedCategory, label: `เพิ่มหมวดหมู่ “${typedCategory}”` }] : []),
  ];

  const save = async (status: 'draft' | 'published') => {
    try {
      const values = await form.validateFields();
      if (!hasBody(doc, plain)) {
        setBodyError('เขียนเนื้อหาบทความ หรือแทรกอย่างน้อยหนึ่งรูป');
        setPreview(false);
        return;
      }
      setSaving(true);
      const savedId = saveBlogPost(
        {
          ...values,
          title: values.title.trim(),
          excerpt: values.excerpt.trim(),
          category: values.category.trim(),
          coverKey: post?.coverKey || 'writing',
          body: plain.trim(),
          bodyDoc: doc,
          status,
        },
        id
      );
      if (!savedId) {
        message.error('เฉพาะแอดมินเท่านั้นที่บันทึกบทความได้');
        return;
      }
      message.success(status === 'published' ? 'เผยแพร่บทความแล้ว' : 'บันทึกฉบับร่างแล้ว');
      setPreview(false);
      navigate(`/admin/articles/${savedId}/edit`);
    } catch {
      /* Ant Design shows validation errors beside the relevant fields. */
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="blog-editor">
      <PageTitle
        eyebrow="บทความ"
        title={isNew ? 'เขียนบทความใหม่' : 'แก้ไขบทความ'}
        subtitle="เขียนในคอลัมน์เดียวกับหน้าที่คนอ่านเห็น จัดรูปในเนื้อหาได้ และเพิ่มหมวดหมู่เองได้"
        actions={
          <Space wrap>
            <Link to="/admin/articles">
              <Button icon={<ArrowLeftOutlined />}>กลับรายการ</Button>
            </Link>
            <Button icon={<EyeOutlined />} onClick={() => setPreview((value) => !value)}>
              {preview ? 'กลับไปแก้ไข' : 'ดูตัวอย่าง'}
            </Button>
            <Button loading={saving} onClick={() => save('draft')}>
              บันทึกฉบับร่าง
            </Button>
            <Button type="primary" loading={saving} onClick={() => save('published')}>
              {post?.status === 'published' ? 'บันทึกและอัปเดต' : 'เผยแพร่บทความ'}
            </Button>
          </Space>
        }
      />
      {preview && (
        <article className="blog-article blog-editor-preview">
          <div className="blog-article-heading">
            <p className="blog-post-meta">
              <span>{category || 'ยังไม่ระบุหมวด'}</span>
              <span aria-hidden="true">·</span>
              <span>โดย {currentUser?.name || 'แอดมิน'}</span>
            </p>
            <h1>{title || 'ชื่อบทความ'}</h1>
            {excerpt && <p>{excerpt}</p>}
          </div>
          <div className="blog-article-cover">
            <img src={cover || blogCoverFor(coverKey)} alt="" />
          </div>
          <div className="blog-article-body">
            <RichDocument document={doc} text={plain} />
          </div>
        </article>
      )}
      <Form
        key={id || 'new'}
        form={form}
        layout="vertical"
        initialValues={post ?? { category: 'การเรียนรู้', coverKey: 'writing' }}
        className={`blog-editor-layout${preview ? ' is-hidden' : ''}`}
      >
        <section className="blog-editor-sheet">
          <Form.Item name="cover" label="ภาพปก">
            <ImageUploadField wide fallback={blogCoverFor(coverKey)} />
          </Form.Item>
          <p className="blog-editor-hint">รูปนี้ใช้บนการ์ดและหัวบทความ รูปที่แทรกระหว่างย่อหน้าให้อยู่ในเนื้อหา</p>
          <Form.Item
            name="title"
            label="ชื่อบทความ"
            rules={[{ required: true, whitespace: true, message: 'กรอกชื่อบทความ' }]}
          >
            <Input size="large" maxLength={120} placeholder="ชื่อที่บอกผู้อ่านว่าจะได้อะไร" />
          </Form.Item>
          <Form.Item
            name="excerpt"
            label="คำเกริ่น"
            rules={[{ required: true, whitespace: true, message: 'เขียนคำเกริ่น' }]}
          >
            <Input.TextArea rows={3} maxLength={240} placeholder="สรุปไอเดียหลักใน 1–2 ประโยค" />
          </Form.Item>
          <p className="blog-editor-hint">สรุปเนื้อหาให้ผู้อ่านรู้ว่าเรื่องนี้เกี่ยวกับอะไร</p>
          <p className="blog-editor-label" id="blog-body-label">
            เนื้อหาบทความ
          </p>
          <RichTextEditor
            key={id || 'new'}
            article
            label="เนื้อหาบทความ"
            document={doc}
            text={plain}
            onChange={(nextDoc, nextText) => {
              setDoc(nextDoc);
              setPlain(nextText);
              setBodyError('');
            }}
          />
          <p className="blog-editor-hint">วางรูปจากคลิปบอร์ดได้ คลิกรูปแล้วเลือกซ้าย กลาง ขวา หรือกว้าง</p>
          {bodyError && (
            <p className="blog-editor-error" role="alert">
              {bodyError}
            </p>
          )}
        </section>
        <aside className="blog-editor-side">
          <Text type="secondary">{post?.status === 'published' ? 'เผยแพร่แล้ว' : 'ฉบับร่าง'}</Text>
          <Form.Item
            name="category"
            label="หมวดหมู่"
            rules={[
              { required: true, whitespace: true, message: 'เลือกหรือพิมพ์หมวดหมู่' },
              { max: 40, message: 'ชื่อหมวดยาวไม่เกิน 40 ตัวอักษร' },
            ]}
          >
            <Select
              showSearch
              options={categoryOptions}
              onSearch={setCategorySearch}
              filterOption={(input, option) => String(option?.label || '').includes(input.trim())}
              placeholder="เลือกหรือพิมพ์หมวดใหม่"
              aria-label="หมวดหมู่"
            />
          </Form.Item>
          <p className="blog-editor-hint">พิมพ์ชื่อที่ยังไม่มี แล้วเลือก «เพิ่มหมวดหมู่» หมวดใหม่จะไปโผล่ในตัวกรองเมื่อเผยแพร่บทความนี้</p>
          <p className="blog-editor-hint">เวลาอ่านโดยประมาณ {Math.max(2, Math.ceil((plain.trim().length || 1) / 500))} นาที</p>
        </aside>
      </Form>
    </div>
  );
}
