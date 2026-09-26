import React, { useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ACCESS_DAYS, SAMPLE_PRICE_USDC, lessonById, teacherById } from './content.js';
import { useLang } from './lang.js';
import { isUnlocked, useChat } from './store.jsx';

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export function UnlockPage() {
  const { lessonId } = useParams();
  const navigate = useNavigate();
  const { data, connectWallet, unlockLesson } = useChat();
  const { label, field } = useLang();
  const lesson = lessonById(lessonId);
  const teacher = lesson && teacherById(lesson.teacherId);
  const [error, setError] = useState('');
  const [paying, setPaying] = useState(false);
  if (!lesson || !teacher) return <p>{label('notFound')}</p>;
  if (lesson.free || isUnlocked(lesson, data)) {
    return <div className="mc-panel mc-stack">
      <h1>{field(lesson.title)}</h1>
      <p>{field(lesson.goal)}</p>
      <Link className="mc-primary" to={`/chat/t/${teacher.id}/${lesson.id}`}>{label('enterLesson')}</Link>
    </div>;
  }

  async function pay(ok) {
    if (!data.wallet) { setError(label('needWallet')); return; }
    setError('');
    setPaying(true);
    await wait(700);
    if (ok) unlockLesson(lesson.id);
    navigate(`/chat/pay/${lesson.id}/result?status=${ok ? 'ok' : 'fail'}`);
  }

  return <div className="mc-stack">
    <Link className="mc-back" to={`/chat/t/${teacher.id}`}>{label('back')}</Link>
    <header>
      <p className="mc-kicker">{field(teacher.name)} · {field(teacher.subject)}</p>
      <h1>{label('unlockTitle')}</h1>
      <p className="mc-lead">{label('unlockLead')}</p>
    </header>
    <section className="mc-panel mc-stack">
      <h2>{field(lesson.title)}</h2>
      <p>{label('goal')}: {field(lesson.goal)}</p>
      <p>{label('priceLabel')}: {SAMPLE_PRICE_USDC} USDC · {ACCESS_DAYS} {data.lang === 'en' ? 'days' : 'วัน'}</p>
      <h2>{label('youGet')}</h2>
      <p>{label('accessFor')}</p>
      <p>{label('offchain')}</p>
      <p>{label('revenueNote')}</p>
    </section>
    <section className="mc-panel mc-stack">
      <h2>{label('wallet')}</h2>
      {data.wallet ? <p className="mc-address">{label('walletOn')} · {data.wallet.address}</p> : <button className="mc-primary" type="button" onClick={connectWallet}>{label('connect')}</button>}
      {error && <p className="mc-error" role="alert">{error}</p>}
      <div className="mc-actions">
        <button className="mc-primary" type="button" disabled={paying} onClick={() => pay(true)}>{paying ? label('paying') : label('pay')}</button>
        <button className="mc-ghost" type="button" disabled={paying} onClick={() => pay(false)}>{label('payFail')}</button>
      </div>
    </section>
  </div>;
}

export function PayResultPage() {
  const { lessonId } = useParams();
  const [params] = useSearchParams();
  const { data } = useChat();
  const { label, field } = useLang();
  const lesson = lessonById(lessonId);
  const teacher = lesson && teacherById(lesson.teacherId);
  if (!lesson || !teacher) return <p>{label('notFound')}</p>;
  const success = params.get('status') === 'ok' && isUnlocked(lesson, data);
  const until = data.unlocks[lesson.id]?.until;
  return <section className="mc-panel mc-stack">
    <p className="mc-kicker">{field(teacher.name)}</p>
    <h1>{success ? label('payOkTitle') : label('payBadTitle')}</h1>
    <p>{success ? label('payOkBody') : label('payBadBody')}</p>
    {success && until && <p>{label('until')} {new Date(until).toLocaleDateString(data.lang === 'en' ? 'en-GB' : 'th-TH')}</p>}
    {data.unlocks[lesson.id]?.ref && <p className="mc-address">{label('example')}: {data.unlocks[lesson.id].ref}</p>}
    <div className="mc-actions">
      {success ? <Link className="mc-primary" to={`/chat/t/${teacher.id}/${lesson.id}`}>{label('enterLesson')}</Link> : <Link className="mc-primary" to={`/chat/unlock/${lesson.id}`}>{label('tryAgain')}</Link>}
      <Link className="mc-ghost" to={`/chat/t/${teacher.id}`}>{label('backToTopics')}</Link>
    </div>
  </section>;
}
