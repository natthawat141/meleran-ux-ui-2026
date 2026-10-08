import React, { useEffect, useRef, useState } from 'react';
import { Alert, Button, Form, Input, Typography } from 'antd';
import { ArrowLeftOutlined, GoogleOutlined, MailOutlined } from '@ant-design/icons';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { AuthFrame } from '@melearn/ui';
import { useLms } from '@legacy/store';
import { DEMO_ACCOUNTS } from '@legacy/data';
import { verificationResendRemainingMs } from '@melearn/contracts';
import { useAuthSession } from '../api/AuthSessionProvider';
import { provisionalDemoAccounts, provisionalLoginError } from '../api/auth-session';
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
  const [email, setEmail] = useState('');
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const { simulateGoogleAuth } = useLms();
  const navigate = useNavigate();
  return (
    <>
      <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
        <UiSeparator className="flex-1" />
        <span>หรือ</span>
        <UiSeparator className="flex-1" />
      </div>
      <UiButton
        type="button"
        variant="outline"
        className="h-10 w-full font-sans"
        onClick={() => setNotice(true)}
      >
        <GoogleOutlined className="text-base" aria-hidden="true" />
        {label}
      </UiButton>
      {notice && <div className="mt-3 space-y-2">
        <Alert type="info" showIcon message="โหมดจำลองสำหรับบัญชี Melearn ที่ Login อยู่" description="ไม่มี Google OAuth จริง ไม่สร้างบัญชีหรือเปลี่ยนบทบาท ต้องใช้อีเมลเดียวกับบัญชีปัจจุบัน และไม่มีการรวมบัญชีอัตโนมัติ" />
        <Input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="อีเมลที่ Google ยืนยันแล้ว" aria-label="อีเมล Google จำลอง" />
        <Button block onClick={() => {
          const auth = simulateGoogleAuth(email);
          setResult({ ok: auth.ok, message: auth.message ?? '' });
          if (auth.ok && auth.user) navigate(auth.user.role === 'admin' ? '/admin' : auth.user.role === 'instructor' ? '/teach' : '/learn');
        }}>บันทึก Google email ที่ยืนยันแล้ว (จำลอง)</Button>
        {result && <Alert type={result.ok ? 'success' : 'warning'} showIcon message={result.message} />}
      </div>}
    </>
  );
}

export interface LoginPageProps {
  audience?: 'web' | 'admin';
}

export function LoginPage({ audience = 'admin' }: LoginPageProps) {
  const { signIn } = useLms();
  const session = useAuthSession();
  const navigate = useNavigate();
  const location = useLocation();
  const [error, setError] = useState('');
  const next = new URLSearchParams(location.search).get('next');
  const loginDemoAccounts = session.enabled
    ? provisionalDemoAccounts.map((account) => ({ ...account, email: account.identifier }))
    : DEMO_ACCOUNTS.filter((account) => account.role === 'admin');

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const identifier = String(form.get('identifier') ?? '').trim();
    const password = String(form.get('password') ?? '');
    if (session.enabled) {
      try {
        await session.login(identifier, password, audience);
        navigate(next || '/admin');
      } catch (error) { setError(provisionalLoginError(error)); }
      return;
    }
    const result = signIn(identifier, password, audience === 'admin' ? 'admin' : undefined);
    if (!result.ok || !result.user) {
      setError(result.message || 'เข้าสู่ระบบไม่สำเร็จ');
      return;
    }
    navigate(audience === 'admin'
      ? next || '/admin'
      : next ||
        (result.user.role === 'learner'
          ? '/learn'
          : result.user.role === 'instructor'
          ? '/teach'
          : '/admin'));
  };

  return (
    <AuthPanel
      variant="entry"
      title="ยินดีต้อนรับกลับ"
      intro={audience === 'admin' ? 'เข้าสู่ระบบ Melearn Admin' : 'เข้าสู่ระบบ MeLearn เพื่อเรียนต่อจากที่ค้างไว้'}
    >
      <FieldDescription className="mb-4 block">
        {session.enabled ? 'เข้าสู่ระบบผ่าน API จำลองสำหรับการพัฒนา ไม่มี Backend จริง' : 'ต้นแบบนี้ตรวจสอบบัญชีจากข้อมูลจำลองในเบราว์เซอร์ ยังไม่เชื่อมต่อระบบบัญชีจริง'}
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
      <GoogleAuthOption label="เข้าสู่ระบบด้วย Google" />
      {audience === 'web' && (
        <div className="auth-switch">
          ยังไม่มีบัญชี? <Link to={next ? `/register?next=${encodeURIComponent(next)}` : '/register'}>สมัครผู้เรียน</Link>
        </div>
      )}
      <details className="login-demo-accounts">
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
      </details>
    </AuthPanel>
  );
}

interface DemoAccountPageProps {
  type: 'forgot' | 'reset';
}

export function DemoAccountPage({ type }: DemoAccountPageProps) {
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [resetEmail, setResetEmail] = useState('');
  const location = useLocation();
  const { resetPassword } = useLms();
  const emailFromUrl = new URLSearchParams(location.search).get('email') ?? '';
  const title = type === 'forgot' ? 'ตั้งรหัสผ่านใหม่' : 'กำหนดรหัสผ่านใหม่';
  const intro = type === 'forgot'
    ? 'กรอกอีเมล แล้วเราจะแสดงผลการส่งลิงก์จำลอง'
    : 'ขั้นตอนนี้แสดงสถานะตัวอย่างในต้นแบบ';

  return (
    <AuthPanel title={title} intro={intro}>
      {error && <Alert className="auth-error" type="error" showIcon message={error} />}
      {sent ? (
        <Alert
          type="success"
          showIcon
          message={type === 'forgot' ? 'สร้างลิงก์เปลี่ยนรหัสผ่านจำลองแล้ว' : 'เปลี่ยนรหัสผ่านแล้ว'}
          description={
            type === 'forgot' ? (
              <Link to={'/reset-password?email=' + encodeURIComponent(resetEmail)}>
                ไปหน้ากำหนดรหัสผ่าน
              </Link>
            ) : (
              <Link to="/login">ไปหน้าเข้าสู่ระบบ</Link>
            )
          }
        />
      ) : (
        <Form<{ email: string; password?: string }>
          layout="vertical"
          initialValues={{ email: emailFromUrl }}
          onFinish={(values) => {
            if (type === 'forgot') {
              setResetEmail(values.email);
              setSent(true);
            } else {
              const result = resetPassword(values.email, values.password || '');
              if (!result.ok) setError(result.message || 'ไม่สามารถรีเซ็ตรหัสผ่านได้');
              else setSent(true);
            }
          }}
        >
          {type === 'forgot' && (
            <Form.Item
              name="email"
              label="อีเมล"
              rules={[{ required: true, type: 'email', message: 'กรอกอีเมลที่ถูกต้อง' }]}
            >
              <Input size="large" prefix={<MailOutlined />} />
            </Form.Item>
          )}
          {type === 'reset' && (
            <>
              <Form.Item
                name="email"
                label="อีเมลบัญชี"
                rules={[{ required: true, type: 'email', message: 'กรอกอีเมลที่ถูกต้อง' }]}
              >
                <Input size="large" prefix={<MailOutlined />} />
              </Form.Item>
              <Form.Item
                label="รหัสผ่านใหม่"
                name="password"
                rules={[{ required: true, min: 8, message: 'ใช้รหัสผ่านอย่างน้อย 8 ตัวอักษร' }]}
              >
                <Input.Password size="large" autoComplete="new-password" />
              </Form.Item>
            </>
          )}
          <Button className="top-space" htmlType="submit" type="primary" block>
            {type === 'forgot' ? 'สร้างลิงก์จำลอง' : 'บันทึกรหัสผ่านใหม่'}
          </Button>
        </Form>
      )}
    </AuthPanel>
  );
}

export function VerifyEmailPage() {
  const { search } = useLocation();
  const { currentUser, data, verifyEmail, resendVerificationEmail } = useLms();
  const token = new URLSearchParams(search).get('token') ?? '';
  const [verificationResult, setVerificationResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [resendResult, setResendResult] = useState<{ ok: boolean; message: string; url?: string } | null>(null);
  const [remainingMs, setRemainingMs] = useState(0);
  const verifiedToken = useRef('');
  useEffect(() => {
    if (!token || verifiedToken.current === token) return;
    verifiedToken.current = token;
    const result = verifyEmail(token);
    setVerificationResult({ ok: result.ok, message: result.message ?? (result.ok ? 'ยืนยันอีเมลสำเร็จ' : 'ลิงก์ใช้ไม่ได้') });
  }, [token, verifyEmail]);
  useEffect(() => {
    const refresh = () => {
      const latest = (data.emailVerifications ?? []).filter((item) => item.userId === currentUser?.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
      setRemainingMs(verificationResendRemainingMs(latest));
    };
    refresh();
    const timer = window.setInterval(refresh, 1000);
    return () => window.clearInterval(timer);
  }, [currentUser?.id, data.emailVerifications]);
  const unverified = currentUser?.emailVerified === false;
  const resend = () => {
    const result = resendVerificationEmail();
    setResendResult({ ok: result.ok, message: result.message ?? '', url: result.verificationUrl });
  };
  const title = verificationResult?.ok || currentUser?.emailVerified === true ? 'อีเมลยืนยันแล้ว' : 'ยืนยันอีเมล';

  return <AuthPanel title={title} intro="สถานะบัญชีและลิงก์นี้จำลองใน browser ของต้นแบบ Melearn">
    {token && verificationResult && <Alert className="bottom-space" type={verificationResult.ok ? 'success' : 'warning'} showIcon message={verificationResult.message} description="ลิงก์ใช้ได้ครั้งเดียว การยืนยันจะไม่สร้างบัญชีใหม่"/>}
    {unverified && <>
      <Alert className="bottom-space" type="info" showIcon message="บัญชียังไม่ได้ยืนยันอีเมล" description="เข้าสู่ระบบได้ แต่ต้องยืนยันก่อนลงเรียน แลกรหัส หรือเริ่มเรียน ลิงก์จำลองมีอายุ 24 ชั่วโมง"/>
      <Button block type="primary" disabled={remainingMs > 0} onClick={resend}>
        {remainingMs > 0 ? `ส่งลิงก์ใหม่ได้ใน ${Math.ceil(remainingMs / 1000)} วินาที` : 'Resend Verification Email'}
      </Button>
    </>}
    {resendResult && <Alert className="top-space" type={resendResult.ok ? 'info' : 'warning'} showIcon message={resendResult.message} description={resendResult.url ? <><p>ไม่มีการส่งอีเมลจริง ลิงก์นี้สร้างไว้ทดลองในต้นแบบเท่านั้น</p><Link to={resendResult.url}>เปิดลิงก์ยืนยันจำลอง</Link></> : undefined}/>}
    {!unverified && !verificationResult?.ok && currentUser?.emailVerified !== true && <Alert showIcon type="info" message="เปิดลิงก์ยืนยันจากบัญชีเดิม หรือเข้าสู่ระบบเพื่อขอลิงก์จำลองใหม่"/>}
    <Link to={unverified ? '/account/profile' : '/login'}><Button className="top-space" block>{unverified ? 'กลับไปบัญชีของฉัน' : 'ไปหน้าเข้าสู่ระบบ'}</Button></Link>
  </AuthPanel>;
}
