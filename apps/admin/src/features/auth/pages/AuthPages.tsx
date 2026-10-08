import React, { useEffect, useRef, useState } from 'react';
import { Alert, Button, Form, Input, Typography } from 'antd';
import { ArrowLeftOutlined, GoogleOutlined, MailOutlined } from '@ant-design/icons';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { AuthFrame } from '@melearn/ui';
import { useAuthSession } from '../api/AuthSessionProvider';
import { authSessionApi, provisionalDemoAccounts, provisionalLoginError } from '../api/auth-session';

import {
  Alert as UiAlert,
  AlertDescription,
  Button as UiButton,
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  Input as UiInput,
  Separator as UiSeparator,
} from '@melearn/ui';

const { Title, Paragraph } = Typography;

interface AuthPanelProps {
  title: string;
  intro: string;
  children: React.ReactNode;
  variant?: 'entry' | string;
}

function AuthPanel({ title, intro, children, variant }: AuthPanelProps) {
  return (
    <AuthFrame variant={variant}>
      <div className={`auth-panel${variant === 'entry' ? ' auth-panel-entry' : ''}`}>
        {variant !== 'entry' && (
          <Link to="/" className="auth-back">
            <ArrowLeftOutlined /> กลับหน้าแรก
          </Link>
        )}
        <Title level={2}>{title}</Title>
        <Paragraph>{intro}</Paragraph>
        {children}
      </div>
    </AuthFrame>
  );
}

interface GoogleAuthOptionProps {
  label: string;
}

function GoogleAuthOption({ label }: GoogleAuthOptionProps) {
  const [notice, setNotice] = useState(false);
  return <><div className="my-5 flex items-center gap-3 text-xs text-muted-foreground"><UiSeparator className="flex-1" /><span>หรือ</span><UiSeparator className="flex-1" /></div>
    <UiButton type="button" variant="outline" className="h-10 w-full font-sans" onClick={() => {
      if (authSessionApi.mock) setNotice(true);
      else window.location.assign(authSessionApi.googleStartUrl());
    }}><GoogleOutlined />{label}</UiButton>
    {notice && <Alert className="top-space" type="info" showIcon message="ยังไม่มี Google OAuth จริง" description="ใช้บัญชีทดสอบเพื่อเข้าสู่ระบบ API จำลอง การเชื่อม Google จริงต้องตั้งค่าที่ Backend" />}
  </>;
}

export interface LoginPageProps {
  audience?: 'web' | 'admin';
}

export function LoginPage({ audience = 'admin' }: LoginPageProps) {
  const session = useAuthSession();
  const navigate = useNavigate();
  const location = useLocation();
  const [error, setError] = useState('');
  const next = new URLSearchParams(location.search).get('next');
  const loginDemoAccounts = provisionalDemoAccounts.map((account) => ({ ...account, email: account.identifier }));

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const identifier = String(form.get('identifier') ?? '').trim();
    const password = String(form.get('password') ?? '');
    try {
      const user = await session.login(identifier, password, audience);
      const role = user.roles.includes('instructor') ? 'instructor' : 'learner';
      const returnTo = next?.startsWith('/') && !next.startsWith('//') && !next.includes('\\') ? next : undefined;
      navigate(audience === 'admin' ? returnTo || '/admin' : returnTo || (role === 'instructor' ? '/teach' : '/learn'));
    } catch (error) { setError(provisionalLoginError(error)); }
  };

  return (
    <AuthPanel
      variant="entry"
      title="ยินดีต้อนรับกลับ"
      intro={audience === 'admin' ? 'เข้าสู่ระบบ Melearn Admin' : 'เข้าสู่ระบบ MeLearn เพื่อเรียนต่อจากที่ค้างไว้'}
    >
      <FieldDescription className="mb-4 block">
        {authSessionApi.mock ? 'เข้าสู่ระบบผ่าน API จำลอง ไม่มี Backend จริง' : 'เข้าสู่ระบบบัญชี Melearn'}
      </FieldDescription>
      {error && (
        <UiAlert variant="destructive" className="mb-5">
          <AlertDescription>{error}</AlertDescription>
        </UiAlert>
      )}
      <form
        className="login-form-shadcn"
        onSubmit={submit}
        onInput={() => error && setError('')}
      >
        <FieldGroup className="gap-4">
          <Field className="gap-1.5">
            <FieldLabel htmlFor="login-identifier">ชื่อผู้ใช้หรืออีเมล</FieldLabel>
            <UiInput
              id="login-identifier"
              name="identifier"
              type="text"
              autoComplete="username"
              placeholder="ชื่อผู้ใช้หรือ name@example.com"
              required
              className="h-10 font-sans"
            />
          </Field>
          <Field className="gap-1.5">
            <div className="login-password-heading">
              <FieldLabel htmlFor="login-password">รหัสผ่าน</FieldLabel>
              <Link to="/forgot-password">ลืมรหัสผ่าน?</Link>
            </div>
            <UiInput
              id="login-password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              className="h-10 font-sans"
            />
          </Field>
          <UiButton type="submit" className="mt-1 h-10 w-full font-sans">
            เข้าสู่ระบบ
          </UiButton>
        </FieldGroup>
      </form>
      {audience === 'web' && <GoogleAuthOption label="เข้าสู่ระบบด้วย Google" />}
      {audience === 'web' && (
        <div className="auth-switch">
          ยังไม่มีบัญชี? <Link to={next ? `/register?next=${encodeURIComponent(next)}` : '/register'}>สมัครผู้เรียน</Link>
        </div>
      )}
      {authSessionApi.mock && <details className="login-demo-accounts">
        <summary>ดูบัญชีสำหรับทดลอง</summary>
        <div className="login-demo-list">
          {loginDemoAccounts.map((account) => (
            <div key={account.email}>
              <span>{account.label}</span>
              <code>{account.email}</code>
              <code>{account.password}</code>
            </div>
          ))}
        </div>
      </details>}
    </AuthPanel>
  );
}

interface DemoAccountPageProps {
  type: 'forgot' | 'reset';
}

export function DemoAccountPage({ type }: DemoAccountPageProps) {
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const location = useLocation();
  const token = new URLSearchParams(location.search).get('token') ?? '';
  const submit = async (values: { identifier: string; password?: string }) => {
    setBusy(true); setError('');
    try {
      if (type === 'forgot') await authSessionApi.requestReset(values.identifier);
      else await authSessionApi.confirmReset(token, values.password ?? '');
      setSent(true);
    } catch (error) { setError(provisionalLoginError(error)); }
    finally { setBusy(false); }
  };
  return <AuthPanel title={type === 'forgot' ? 'ตั้งรหัสผ่านใหม่' : 'กำหนดรหัสผ่านใหม่'} intro={type === 'forgot' ? 'กรอกชื่อผู้ใช้หรืออีเมลเพื่อขอลิงก์ตั้งรหัสผ่าน' : 'ใช้ลิงก์ยืนยันที่ส่งไปยังอีเมลของคุณ'}>
    {error && <Alert type="error" showIcon message={error} />}
    {sent ? <Alert type="success" showIcon message={type === 'forgot' ? 'รับคำขอแล้ว หากบัญชีมีอีเมลที่ยืนยันแล้ว ระบบจะส่งลิงก์ให้' : 'เปลี่ยนรหัสผ่านแล้ว'} description={<Link to="/login">ไปหน้าเข้าสู่ระบบ</Link>} /> :
      <Form layout="vertical" onFinish={submit}>
        {type === 'forgot' ? <Form.Item name="identifier" label="ชื่อผู้ใช้หรืออีเมล" rules={[{ required: true }]}><Input size="large" prefix={<MailOutlined />} /></Form.Item> : <>
          {!token && <Alert type="warning" showIcon message="เปิดหน้านี้จากลิงก์ตั้งรหัสผ่านในอีเมล" />}
          <Form.Item name="password" label="รหัสผ่านใหม่" rules={[{ required: true, min: 8 }]}><Input.Password autoComplete="new-password" size="large" /></Form.Item>
        </>}
        <Button type="primary" htmlType="submit" loading={busy} disabled={type === 'reset' && !token} block>{type === 'forgot' ? 'ส่งลิงก์ตั้งรหัสผ่าน' : 'บันทึกรหัสผ่านใหม่'}</Button>
      </Form>}
  </AuthPanel>;
}

export function VerifyEmailPage() {
  const { search } = useLocation();
  const session = useAuthSession();
  const token = new URLSearchParams(search).get('token') ?? '';
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const verification = useRef<{ token: string; promise: Promise<void> } | null>(null);
  useEffect(() => {
    if (!token) return;
    let active = true;
    if (verification.current?.token !== token) verification.current = { token, promise: authSessionApi.verify(token) };
    verification.current.promise.then(async () => {
      await session.refresh(); if (active) setResult({ ok: true, message: 'ยืนยันอีเมลสำเร็จ' });
    }).catch((error) => { if (active) setResult({ ok: false, message: provisionalLoginError(error) }); });
    return () => { active = false; };
  }, [token, session.refresh]);
  const resend = async () => {
    if (!session.user?.email) return;
    setBusy(true);
    try { await authSessionApi.resend(session.user.email); setResult({ ok: true, message: 'รับคำขอส่งลิงก์ยืนยันแล้ว' }); }
    catch (error) { setResult({ ok: false, message: provisionalLoginError(error) }); }
    finally { setBusy(false); }
  };
  return <AuthPanel title={session.user?.email_verified ? 'อีเมลยืนยันแล้ว' : 'ยืนยันอีเมล'} intro="เปิดลิงก์จากอีเมลเพื่อยืนยันบัญชีของคุณ">
    {result && <Alert showIcon type={result.ok ? 'success' : 'error'} message={result.message} />}
    {session.user && !session.user.email_verified && <><Alert className="bottom-space" type="info" showIcon message="ยืนยันอีเมลก่อนลงเรียน แลกรหัส หรือเริ่มเรียน" /><Button block type="primary" loading={busy} onClick={resend}>ส่งลิงก์ยืนยันอีเมลอีกครั้ง</Button></>}
    <Link to={session.user ? '/account/profile' : '/login'}><Button className="top-space" block>{session.user ? 'กลับไปบัญชีของฉัน' : 'เข้าสู่ระบบ'}</Button></Link>
  </AuthPanel>;
}
