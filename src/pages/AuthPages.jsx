import React, { useState } from 'react';
import { Alert, Button, Form, Input, Space, Typography } from 'antd';
import { ArrowLeftOutlined, GoogleOutlined, LockOutlined, MailOutlined } from '@ant-design/icons';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { AuthFrame } from '../components/Shell.jsx';
import { PageTitle } from '../components/common.jsx';
import { useLms } from '../store.jsx';
import { DEMO_ACCOUNTS } from '../data.js';
import { Alert as UiAlert, AlertDescription } from '../components/ui/alert.jsx';
import { Button as UiButton } from '../components/ui/button.jsx';
import { Field, FieldDescription, FieldGroup, FieldLabel } from '../components/ui/field.jsx';
import { Input as UiInput } from '../components/ui/input.jsx';
import { Separator as UiSeparator } from '../components/ui/separator.jsx';

const { Title, Paragraph } = Typography;

function AuthPanel({ title, intro, children, variant }) {
  return <AuthFrame variant={variant}><div className={`auth-panel${variant === 'entry' ? ' auth-panel-entry' : ''}`}>{variant !== 'entry' && <Link to="/" className="auth-back"><ArrowLeftOutlined /> กลับหน้าแรก</Link>}<Title level={2}>{title}</Title><Paragraph>{intro}</Paragraph>{children}</div></AuthFrame>;
}

function GoogleAuthOption({ label }) {
  const [notice, setNotice] = useState(false);
  return <>
    <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground"><UiSeparator className="flex-1" /><span>หรือ</span><UiSeparator className="flex-1" /></div>
    <UiButton type="button" variant="outline" className="h-10 w-full font-sans" onClick={() => setNotice(true)}><GoogleOutlined className="text-base" aria-hidden="true" />{label}</UiButton>
    {notice && <UiAlert className="mt-3"><AlertDescription>Google Login ยังไม่เปิดใช้งานในต้นแบบนี้ เราจะเชื่อมต่อเมื่อเพิ่ม Firebase</AlertDescription></UiAlert>}
  </>;
}

export function LoginPage() {
  const { signIn } = useLms();
  const navigate = useNavigate();
  const location = useLocation();
  const [error, setError] = useState('');
  const next = new URLSearchParams(location.search).get('next');
  const submit = (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const email = String(form.get('email') ?? '').trim();
    const password = String(form.get('password') ?? '');
    const result = signIn(email, password);
    if (!result.ok) { setError(result.message); return; }
    navigate(next || (result.user.role === 'learner' ? '/learn' : result.user.role === 'instructor' ? '/teach' : '/admin'));
  };
  return <AuthPanel variant="entry" title="ยินดีต้อนรับกลับ" intro="เข้าสู่ระบบ MeLearn เพื่อเรียนต่อจากที่ค้างไว้">
    {error && <UiAlert variant="destructive" className="mb-5"><AlertDescription>{error}</AlertDescription></UiAlert>}
    <form className="login-form-shadcn" onSubmit={submit} onInput={() => error && setError('')}>
      <FieldGroup className="gap-4">
        <Field className="gap-1.5">
          <FieldLabel htmlFor="login-email">อีเมล</FieldLabel>
          <UiInput id="login-email" name="email" type="email" autoComplete="email" placeholder="name@example.com" required className="h-10 font-sans" />
        </Field>
        <Field className="gap-1.5">
          <div className="login-password-heading"><FieldLabel htmlFor="login-password">รหัสผ่าน</FieldLabel><Link to="/forgot-password">ลืมรหัสผ่าน?</Link></div>
          <UiInput id="login-password" name="password" type="password" autoComplete="current-password" required className="h-10 font-sans" />
        </Field>
        <UiButton type="submit" className="mt-1 h-10 w-full font-sans">เข้าสู่ระบบ</UiButton>
      </FieldGroup>
    </form>
    <GoogleAuthOption label="เข้าสู่ระบบด้วย Google" />
    <div className="auth-switch">ยังไม่มีบัญชี? <Link to="/register">สมัครผู้เรียน</Link></div>
    <details className="login-demo-accounts"><summary>ดูบัญชีสำหรับทดลอง</summary><div className="login-demo-list">{DEMO_ACCOUNTS.map((account) => <div key={account.role}><span>{account.label}</span><code>{account.email}</code><code>{account.password}</code></div>)}</div></details>
  </AuthPanel>;
}

export function RegisterPage() {
  const { register } = useLms();
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const submit = (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const name = String(form.get('name') ?? '').trim();
    const email = String(form.get('email') ?? '').trim();
    const password = String(form.get('password') ?? '');
    const confirm = String(form.get('confirm') ?? '');
    if (password !== confirm) { setError('รหัสผ่านไม่ตรงกัน'); return; }
    const result = register({ name, email, password });
    if (!result.ok) { setError(result.message); return; }
    navigate('/learn');
  };
  return <AuthPanel variant="entry" title="สร้างบัญชีผู้เรียน" intro="เริ่มเรียนคอร์สฟรีและติดตามความคืบหน้าของคุณ">
    {error && <UiAlert variant="destructive" className="mb-5"><AlertDescription>{error}</AlertDescription></UiAlert>}
    <form className="login-form-shadcn" onSubmit={submit} onInput={() => error && setError('')}>
      <FieldGroup className="gap-4">
        <Field className="gap-1.5">
          <FieldLabel htmlFor="register-name">ชื่อที่ใช้แสดง</FieldLabel>
          <UiInput id="register-name" name="name" autoComplete="name" placeholder="ชื่อของคุณ" required className="h-10 font-sans" />
        </Field>
        <Field className="gap-1.5">
          <FieldLabel htmlFor="register-email">อีเมล</FieldLabel>
          <UiInput id="register-email" name="email" type="email" autoComplete="email" placeholder="name@example.com" required className="h-10 font-sans" />
        </Field>
        <Field className="gap-1.5">
          <FieldLabel htmlFor="register-password">รหัสผ่าน</FieldLabel>
          <UiInput id="register-password" name="password" type="password" autoComplete="new-password" minLength={8} required className="h-10 font-sans" />
          <FieldDescription className="text-xs">อย่างน้อย 8 ตัวอักษร</FieldDescription>
        </Field>
        <Field className="gap-1.5">
          <FieldLabel htmlFor="register-confirm">ยืนยันรหัสผ่าน</FieldLabel>
          <UiInput id="register-confirm" name="confirm" type="password" autoComplete="new-password" required className="h-10 font-sans" />
        </Field>
        <UiButton type="submit" className="mt-1 h-10 w-full font-sans">สร้างบัญชี</UiButton>
      </FieldGroup>
    </form>
    <GoogleAuthOption label="สมัครด้วย Google" />
    <div className="auth-switch">มีบัญชีแล้ว? <Link to="/login">เข้าสู่ระบบ</Link></div>
  </AuthPanel>;
}

export function BecomeInstructorPage() {
  const { currentUser, requestInstructor } = useLms();
  const [submitted, setSubmitted] = useState(false);
  if (!currentUser) return <AuthPanel title="เริ่มต้นเส้นทางผู้สอน" intro="ส่งข้อมูลแนะนำตัวเพื่อให้แอดมินพิจารณา"><Alert type="info" showIcon message="เข้าสู่ระบบหรือสมัครผู้เรียนก่อนส่งคำขอ"/><Space className="form-space"><Link to="/login"><Button type="primary">เข้าสู่ระบบ</Button></Link><Link to="/register"><Button>สมัครบัญชี</Button></Link></Space></AuthPanel>;
  return <div className="public-page instructor-apply"><PageTitle title="แบ่งปันความรู้ของคุณ" subtitle="ส่งคำขอเป็นผู้สอน แอดมินจะตรวจข้อมูลก่อนเปิดพื้นที่สร้างคอร์ส"/>{submitted ? <Alert type="success" showIcon message="ส่งคำขอแล้ว" description="คุณจะเห็นสถานะคำขอในพื้นที่บัญชีของคุณหลังจากแอดมินพิจารณา"/> : <Form layout="vertical" className="instructor-apply-form" onFinish={(values) => { requestInstructor(values); setSubmitted(true); }}><Form.Item label="แนะนำตัวและหัวข้อที่อยากสอน" name="intro" rules={[{ required: true, min: 20, message: 'เขียนอย่างน้อย 20 ตัวอักษร' }]}><Input.TextArea rows={6} placeholder="เล่าประสบการณ์และกลุ่มผู้เรียนที่คุณอยากช่วย"/></Form.Item><Button type="primary" htmlType="submit">ส่งคำขอให้แอดมิน</Button></Form>}</div>;
}

export function DemoAccountPage({ type }) {
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [resetEmail, setResetEmail] = useState('');
  const { token } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { data, acceptInstructorInvite, resetPassword } = useLms();
  const emailFromUrl = new URLSearchParams(location.search).get('email') ?? '';
  const invitation = data.invitations.find((item) => item.token === token && item.status === 'pending');
  const title = type === 'forgot' ? 'ตั้งรหัสผ่านใหม่' : type === 'reset' ? 'กำหนดรหัสผ่านใหม่' : type === 'invite' ? 'รับคำเชิญเป็นผู้สอน' : 'ยืนยันอีเมล';
  const intro = type === 'forgot' ? 'กรอกอีเมล แล้วเราจะแสดงผลการส่งลิงก์จำลอง' : type === 'invite' ? `คำเชิญตัวอย่าง ${token ?? ''} สำหรับบัญชีผู้สอน` : 'ขั้นตอนนี้แสดงสถานะตัวอย่างในต้นแบบ';
  if (type === 'invite') return <AuthPanel title={title} intro={invitation ? `คำเชิญสำหรับ ${invitation.email}` : 'ลิงก์คำเชิญนี้ใช้ไม่ได้หรือถูกตอบรับแล้ว'}>{invitation ? <Form layout="vertical" onFinish={(values) => { const result = acceptInstructorInvite(token, values.password); if (result.ok) navigate('/teach'); }}><Form.Item label="รหัสผ่านใหม่" name="password" rules={[{ required: true, min: 8, message: 'ใช้รหัสผ่านอย่างน้อย 8 ตัวอักษร' }]}><Input.Password size="large" autoComplete="new-password"/></Form.Item><Button type="primary" htmlType="submit" block>รับคำเชิญและเปิดบัญชีผู้สอน</Button></Form> : <Link to="/"><Button type="primary">กลับหน้าแรก</Button></Link>}</AuthPanel>;
  return <AuthPanel title={title} intro={intro}>{error && <Alert className="auth-error" type="error" showIcon message={error}/>} {sent ? <Alert type="success" showIcon message={type === 'forgot' ? 'สร้างลิงก์เปลี่ยนรหัสผ่านจำลองแล้ว' : 'เปลี่ยนรหัสผ่านแล้ว'} description={type === 'forgot' ? <Link to={`/reset-password?email=${encodeURIComponent(resetEmail)}`}>ไปหน้ากำหนดรหัสผ่าน</Link> : <Link to="/login">ไปหน้าเข้าสู่ระบบ</Link>}/> : <Form layout="vertical" initialValues={{ email: emailFromUrl }} onFinish={(values) => { if (type === 'forgot') { setResetEmail(values.email); setSent(true); } else { const result = resetPassword(values.email, values.password); if (!result.ok) setError(result.message); else setSent(true); } }}>{type === 'forgot' && <Form.Item name="email" label="อีเมล" rules={[{ required: true, type: 'email', message: 'กรอกอีเมลที่ถูกต้อง' }]}><Input size="large" prefix={<MailOutlined />}/></Form.Item>}{type === 'reset' && <><Form.Item name="email" label="อีเมลบัญชี" rules={[{ required: true, type: 'email', message: 'กรอกอีเมลที่ถูกต้อง' }]}><Input size="large" prefix={<MailOutlined />}/></Form.Item><Form.Item label="รหัสผ่านใหม่" name="password" rules={[{ required: true, min: 8, message: 'ใช้รหัสผ่านอย่างน้อย 8 ตัวอักษร' }]}><Input.Password size="large" autoComplete="new-password"/></Form.Item></>}<Button className="top-space" htmlType="submit" type="primary" block>{type === 'forgot' ? 'สร้างลิงก์จำลอง' : 'บันทึกรหัสผ่านใหม่'}</Button></Form>}</AuthPanel>;
}

export function VerifyEmailPage() {
  return <AuthPanel title="ยืนยันอีเมลแล้ว" intro="สถานะนี้จำลองเพื่อให้ทดลองเส้นทางบัญชีได้ครบ"><Alert type="success" showIcon message="อีเมลของคุณได้รับการยืนยันในต้นแบบแล้ว"/><Link to="/login"><Button className="top-space" type="primary" block>ไปหน้าเข้าสู่ระบบ</Button></Link></AuthPanel>;
}
