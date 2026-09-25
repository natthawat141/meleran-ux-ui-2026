import React, { useState } from 'react';
import { Button, Empty, Form, Input, Modal, Popconfirm, Segmented, Select, Space, Table, Tag, Typography, message } from 'antd';
import { AppstoreOutlined, ArrowLeftOutlined, EyeOutlined, PlusOutlined, UnorderedListOutlined } from '@ant-design/icons';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useLms } from '../../store.jsx';
import { blogCoverFor } from '../../data.js';
import { PageTitle } from '../../components/common.jsx';
import { ImageUploadField } from '../../components/ImageUploadField.jsx';

const { Text } = Typography;

export function AdminBlogPage() {
  const { data, removeBlogPost } = useLms();
  const [view, setView] = useState('table');
  const [query, setQuery] = useState('');
  const posts = [...data.blogPosts].filter((post) => `${post.title} ${post.category}`.toLowerCase().includes(query.toLowerCase().trim())).sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  const actions = (post) => <Space wrap><Link to={`/articles/${post.id}`}><Button icon={<EyeOutlined />}>ดู</Button></Link><Link to={`/admin/articles/${post.id}/edit`}><Button>แก้ไข</Button></Link><Popconfirm title="ลบบทความนี้?" description="การลบจะนำบทความออกจากหน้าเว็บทันที" okText="ลบ" cancelText="ยกเลิก" okButtonProps={{ danger: true }} onConfirm={() => { removeBlogPost(post.id); message.success('ลบบทความแล้ว'); }}><Button danger>ลบ</Button></Popconfirm></Space>;
  const columns = [
    { title: 'บทความ', render: (_, post) => <div className="table-course-name"><strong>{post.title}</strong><Text type="secondary">{post.category} · อ่าน {post.readingMinutes ?? 3} นาที</Text></div> },
    { title: 'สถานะ', render: (_, post) => post.status === 'published' ? <Tag color="processing">เผยแพร่แล้ว</Tag> : <Tag>ฉบับร่าง</Tag> },
    { title: 'แก้ไขล่าสุด', render: (_, post) => new Date(post.updatedAt).toLocaleDateString('th-TH') },
    { title: 'จัดการ', render: (_, post) => actions(post) },
  ];
  return <><PageTitle eyebrow="ผู้ดูแลระบบ" title="บทความ" subtitle="เขียนและเผยแพร่บทความให้ทุกคนอ่านได้โดยไม่ต้องเข้าสู่ระบบ" actions={<Link to="/admin/articles/new"><Button type="primary" icon={<PlusOutlined />}>เขียนบทความ</Button></Link>}/>
    <div className="collection-toolbar"><Input placeholder="ค้นหาบทความ" aria-label="ค้นหาบทความ" allowClear value={query} onChange={(event) => setQuery(event.target.value)}/><Segmented aria-label="มุมมองบทความ" value={view} onChange={setView} options={[{ value: 'table', label: 'ตาราง', icon: <UnorderedListOutlined/> }, { value: 'card', label: 'การ์ด', icon: <AppstoreOutlined/> }]}/></div>
    {view === 'table' ? <Table rowKey="id" columns={columns} dataSource={posts} pagination={{ pageSize: 8 }} locale={{ emptyText: 'ยังไม่มีบทความที่ตรงกับคำค้น' }} scroll={{ x: 780 }}/> : posts.length ? <div className="admin-post-grid">{posts.map((post) => <article className="admin-post-card" key={post.id}><Link to={`/admin/articles/${post.id}/edit`}><img src={post.cover || blogCoverFor(post.coverKey)} alt=""/></Link><div><Tag color={post.status === 'published' ? 'processing' : undefined}>{post.status === 'published' ? 'เผยแพร่แล้ว' : 'ฉบับร่าง'}</Tag><h2>{post.title}</h2><p>{post.category} · {new Date(post.updatedAt).toLocaleDateString('th-TH')}</p>{actions(post)}</div></article>)}</div> : <Empty description="ไม่พบบทความ"/>}
  </>;
}

export function AdminBlogEditorPage() {
  const { id } = useParams();
  const isNew = !id;
  const { data, saveBlogPost } = useLms();
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState(null);
  const post = data.blogPosts.find((item) => item.id === id);
  const coverKey = Form.useWatch('coverKey', form) ?? post?.coverKey ?? 'writing';
  if (!isNew && !post) return <Empty description="ไม่พบบทความนี้" />;
  const save = async (status) => {
    try {
      const values = await form.validateFields();
      setSaving(true);
      const savedId = saveBlogPost({ ...values, title: values.title.trim(), excerpt: values.excerpt.trim(), body: values.body.trim(), status }, id);
      if (!savedId) { message.error('เฉพาะแอดมินเท่านั้นที่บันทึกบทความได้'); return; }
      message.success(status === 'published' ? 'เผยแพร่บทความแล้ว' : 'บันทึกฉบับร่างแล้ว');
      navigate(`/admin/articles/${savedId}/edit`);
    } catch { /* Ant Design shows validation errors beside the relevant fields. */ }
    finally { setSaving(false); }
  };
  return <><PageTitle eyebrow="บทความ" title={isNew ? 'เขียนบทความใหม่' : 'แก้ไขบทความ'} subtitle="เขียนเนื้อหา เลือกภาพปก แล้วดูตัวอย่างก่อนเผยแพร่" actions={<Space><Link to="/admin/articles"><Button icon={<ArrowLeftOutlined />}>กลับรายการ</Button></Link><Button icon={<EyeOutlined />} onClick={() => setPreview(form.getFieldsValue())}>ดูตัวอย่าง</Button></Space>}/>
    <Form form={form} layout="vertical" initialValues={post ?? { category: 'การเรียนรู้', coverKey: 'writing' }} className="content-edit-layout">
      <section className="content-edit-main">
        <Form.Item name="title" label="ชื่อบทความ" rules={[{ required: true, whitespace: true, message: 'กรอกชื่อบทความ' }]}><Input maxLength={120} placeholder="ชื่อที่บอกผู้อ่านว่าจะได้อะไร" /></Form.Item>
        <Form.Item name="excerpt" label="คำเกริ่น" extra="สรุปเนื้อหาให้ผู้อ่านรู้ว่าเรื่องนี้เกี่ยวกับอะไร" rules={[{ required: true, whitespace: true, message: 'เขียนคำเกริ่น' }]}><Input.TextArea rows={3} maxLength={240} placeholder="สรุปไอเดียหลักใน 1–2 ประโยค" /></Form.Item>
        <Form.Item name="body" label="เนื้อหาบทความ" extra="เว้นบรรทัดว่างเพื่อเริ่มย่อหน้าใหม่" rules={[{ required: true, whitespace: true, message: 'เขียนเนื้อหาบทความ' }]}><Input.TextArea autoSize={{ minRows: 14, maxRows: 30 }} placeholder="เริ่มเขียนเนื้อหาที่นี่..." /></Form.Item>
      </section>
      <aside className="content-edit-side">
        <Form.Item name="cover" label="ภาพปกบทความ"><ImageUploadField fallback={blogCoverFor(coverKey)}/></Form.Item>
        <Form.Item name="category" label="หมวดหมู่" rules={[{ required: true, message: 'เลือกหมวดหมู่' }]}><Select options={['การเรียนรู้', 'การสื่อสาร', 'ข้อมูลและดิจิทัล', 'การทำงาน'].map((value) => ({ value, label: value }))} /></Form.Item>
        <div className="editor-save-actions"><Text type="secondary">{post?.status === 'published' ? 'เผยแพร่แล้ว' : 'ฉบับร่าง'}</Text><Button block type="primary" loading={saving} onClick={() => save('published')}>{post?.status === 'published' ? 'บันทึกและอัปเดต' : 'เผยแพร่บทความ'}</Button><Button block loading={saving} onClick={() => save('draft')}>บันทึกฉบับร่าง</Button></div>
      </aside>
    </Form>
    <Modal title="ตัวอย่างบทความ" open={Boolean(preview)} onCancel={() => setPreview(null)} footer={null} width={800}><div className="article-edit-preview"><img src={preview?.cover || blogCoverFor(coverKey)} alt=""/><h1>{preview?.title || 'ชื่อบทความ'}</h1><p>{preview?.excerpt}</p>{preview?.body?.split(/\n\s*\n/).map((paragraph, index) => <p key={index}>{paragraph}</p>)}</div></Modal>
  </>;
}
