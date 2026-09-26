import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { lessonById, lessonsFor, teacherById } from './content.js';
import { useLang } from './lang.js';
import { IconBack, IconHint, IconImage, IconSend } from './icons.jsx';
import { isUnlocked, useChat } from './store.jsx';

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export function ChatRoom() {
  const { teacherId, lessonId } = useParams();
  const navigate = useNavigate();
  const room = useChat();
  const { data, ensureThread, addLearnerMessage, planReply, commitReply } = room;
  const { label, field } = useLang();
  const lesson = lessonById(lessonId);
  const teacher = teacherById(teacherId);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const threadRef = useRef(null);
  const fileRef = useRef(null);
  const progress = data.progress[lessonId];
  const messages = data.threads[lessonId] ?? [];
  const step = lesson?.steps[Math.min(progress?.step ?? 0, (lesson?.steps.length ?? 1) - 1)];
  const allowed = lesson && teacher && lesson.teacherId === teacher.id && isUnlocked(lesson, data);

  useEffect(() => {
    if (lesson && teacher && lesson.teacherId === teacher.id && !isUnlocked(lesson, data)) {
      navigate(`/chat/unlock/${lesson.id}`, { replace: true });
      return;
    }
    if (allowed) ensureThread(lesson.id);
  }, [allowed, data, ensureThread, lesson, navigate, teacher]);

  useEffect(() => {
    const node = threadRef.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, [messages.length, pending]);

  if (!lesson || !teacher || lesson.teacherId !== teacher.id) {
    return <div className="mc-app"><main className="mc-main"><p>{label('notFound')}</p><Link to="/chat">{label('backHome')}</Link></main></div>;
  }
  if (!isUnlocked(lesson, data)) return null;

  const siblings = lessonsFor(teacher.id);
  const next = siblings[siblings.findIndex((item) => item.id === lesson.id) + 1];

  async function respond(action, text, image) {
    if (pending) return;
    if (action === 'message' && !text.trim()) {
      setError(label('emptySend'));
      return;
    }
    setError('');
    if (action === 'message') addLearnerMessage(lesson.id, { text: text.trim() });
    if (action === 'image') addLearnerMessage(lesson.id, { text: data.lang === 'en' ? 'Sent a picture' : 'ส่งรูป', image });
    setDraft('');
    setPending(true);
    await wait(650);
    commitReply(lesson.id, planReply(lesson.id, action, text));
    setPending(false);
  }

  function onAttach(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/') || file.size > 700000) {
      setError(data.lang === 'en' ? 'Use an image under 700 KB.' : 'ใช้รูปที่เล็กกว่า 700 KB');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => respond('image', '', String(reader.result));
    reader.readAsDataURL(file);
  }

  return <section className="mc-room" aria-label={field(lesson.title)}>
    <header className="mc-room-head">
      <Link className="mc-icon-btn" to={`/chat/t/${teacher.id}`} aria-label={label('back')}><IconBack /></Link>
      <img src={teacher.portrait} alt="" />
      <div>
        <h1>{field(teacher.name)}</h1>
        <p>{field(lesson.title)} · {progress?.passed ? label('passed') : `${label('step')} ${(progress?.step ?? 0) + 1} ${label('of')} ${lesson.steps.length}`}</p>
      </div>
    </header>
    <div className="mc-room-body">
      <div className="mc-thread" ref={threadRef} aria-live="polite">
        {messages.map((message) => <div className={`mc-row ${message.role}`} key={message.id}>
          <div className="mc-bubble">
            {message.text}
            {message.image && <img src={message.image} alt="" />}
          </div>
        </div>)}
        {pending && <div className="mc-row teacher"><div className="mc-bubble mc-typing" aria-label={label('typing')}><i /><i /><i /></div></div>}
      </div>
      <aside className="mc-side">
        <h2>{label('goal')}</h2>
        <p>{field(lesson.goal)}</p>
        <h2>{label('passRule')}</h2>
        <p>{field(lesson.pass)}</p>
        <h2>{label('howTheyTeach')}</h2>
        <ul className="mc-style">{teacher.style.map((item) => <li key={item.th}>{field(item)}</li>)}</ul>
      </aside>
    </div>
    {progress?.passed && <div className="mc-done">
      <strong>{label('lessonDone')}</strong>
      <div className="mc-actions">
        {next ? <Link className="mc-primary" to={isUnlocked(next, data) ? `/chat/t/${teacher.id}/${next.id}` : `/chat/unlock/${next.id}`}>{label('nextLesson')}</Link> : <Link className="mc-ghost" to={`/chat/t/${teacher.id}`}>{label('backToTopics')}</Link>}
      </div>
    </div>}
    <form className="mc-compose" onSubmit={(event) => { event.preventDefault(); respond('message', draft); }}>
      {error && <p className="mc-error" role="alert">{error}</p>}
      <div className="mc-tools">
        <button type="button" onClick={() => respond('hint')}><IconHint />{label('hint')}</button>
        <button type="button" onClick={() => respond('explain')}>{label('explain')}</button>
        <button type="button" onClick={() => setDraft(step?.example ?? '')}>{label('fillExample')}</button>
        <button type="button" onClick={() => fileRef.current?.click()}><IconImage />{label('attach')}</button>
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={onAttach} />
      </div>
      <div className="mc-box">
        <label className="mc-sr" htmlFor="mc-message" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden' }}>{label('messageLabel')}</label>
        <textarea id="mc-message" value={draft} placeholder={label('placeholder')} rows={2} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => {
          if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); respond('message', draft); }
        }} />
        <button className="mc-send" type="submit" aria-label={label('send')} disabled={pending}><IconSend /></button>
      </div>
    </form>
  </section>;
}
