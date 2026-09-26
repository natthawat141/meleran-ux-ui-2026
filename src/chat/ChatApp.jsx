import React from 'react';
import { Link, NavLink, Route, Routes, useParams } from 'react-router-dom';
import logo from '../assets/melearn-ui/logo.PNG';
import { lessonById, lessonsFor, teacherById, teachers } from './content.js';
import { ChatRoom } from './ChatRoom.jsx';
import { IconHome, IconLearn, IconUser } from './icons.jsx';
import { useLang } from './lang.js';
import { PayResultPage, UnlockPage } from './PayPages.jsx';
import { ChatProvider, isUnlocked, useChat } from './store.jsx';
import './chat.css';

function statusOf(lesson, data) {
  const progress = data.progress[lesson.id];
  if (!isUnlocked(lesson, data)) return 'locked';
  if (progress?.passed) return 'passed';
  if (progress) return 'progress';
  return 'new';
}

function latestLesson(data) {
  const ids = Object.keys(data.progress);
  if (!ids.length) return null;
  ids.sort((a, b) => (data.progress[b].updatedAt || 0) - (data.progress[a].updatedAt || 0));
  return ids.map((id) => data.progress[id] && { id, ...data.progress[id] }).find(Boolean);
}

function Shell({ children }) {
  const { data, setLang } = useChat();
  const { label } = useLang();
  const item = (to, icon, name) => <NavLink to={to} end={to === '/chat'}>{icon}{name}</NavLink>;
  return <>
    <a className="mc-skip" href="#mc-main">{data.lang === 'en' ? 'Skip to content' : 'ข้ามไปเนื้อหา'}</a>
    <header className="mc-top">
      <Link to="/chat" className="mc-brand" aria-label="melearn chat">
        <span className="mc-logo"><img src={logo} alt="" /></span>
        <span className="mc-word"><strong>melearn</strong> chat</span>
      </Link>
      <nav className="mc-topnav" aria-label={label('brand')}>
        {item('/chat', null, label('navHome'))}
        {item('/chat/learn', null, label('navLearn'))}
        {item('/chat/profile', null, label('navProfile'))}
      </nav>
      <div className="mc-lang" role="group" aria-label={label('language')}>
        <button type="button" aria-pressed={data.lang === 'th'} onClick={() => setLang('th')}>ไทย</button>
        <button type="button" aria-pressed={data.lang === 'en'} onClick={() => setLang('en')}>EN</button>
      </div>
    </header>
    <main id="mc-main" className="mc-main">{children}</main>
    <nav className="mc-bottom" aria-label={label('brand')}>
      {item('/chat', <IconHome />, label('navHome'))}
      {item('/chat/learn', <IconLearn />, label('navLearn'))}
      {item('/chat/profile', <IconUser />, label('navProfile'))}
    </nav>
  </>;
}

function HomePage() {
  const { data } = useChat();
  const { label, field } = useLang();
  const recent = latestLesson(data);
  const lesson = recent && lessonById(recent.id);
  const teacher = lesson && teacherById(lesson.teacherId);
  return <>
    <p className="mc-kicker">melearn chat</p>
    <h1>{label('tagline')}</h1>
    <p className="mc-lead">{label('intro')}</p>
    <p className="mc-flow">{label('flow')}</p>
    <p className="mc-note">{label('demoNote')}</p>
    {lesson && teacher && <article className="mc-resume">
      <img src={teacher.portrait} alt="" />
      <div>
        <p className="mc-subject">{label('continueLearning')}</p>
        <strong>{field(lesson.title)}</strong>
        <p>{field(teacher.name)} · {recent.passed ? label('passed') : label('inProgress')}</p>
      </div>
      <Link className="mc-primary" to={isUnlocked(lesson, data) ? `/chat/t/${teacher.id}/${lesson.id}` : `/chat/unlock/${lesson.id}`}>{label('continueAction')}</Link>
    </article>}
    <div className="mc-section-title"><h2>{label('chooseTeacher')}</h2></div>
    <div className="mc-grid">
      {teachers.map((item) => <article className="mc-card" key={item.id}>
        <img src={item.portrait} alt="" />
        <div className="mc-card-body">
          <div className="mc-subject">{field(item.subject)}</div>
          <h3>{field(item.name)}</h3>
          <p>{field(item.character)}</p>
          <Link className="mc-primary" to={`/chat/t/${item.id}`}>{label('startChat')}</Link>
        </div>
      </article>)}
    </div>
  </>;
}

function TopicsPage() {
  const { teacherId } = useParams();
  const { data } = useChat();
  const { label, field } = useLang();
  const teacher = teacherById(teacherId);
  if (!teacher) return <Missing />;
  const statusLabel = { locked: 'locked', passed: 'passed', progress: 'inProgress', new: 'notStarted' };
  return <>
    <Link className="mc-back" to="/chat">{label('back')}</Link>
    <header className="mc-teacher-head">
      <img src={teacher.portrait} alt="" />
      <div>
        <div className="mc-subject">{field(teacher.subject)}</div>
        <h1>{field(teacher.name)}</h1>
        <p className="mc-lead">{field(teacher.character)}</p>
      </div>
    </header>
    <h2>{label('howTheyTeach')}</h2>
    <ul className="mc-style">{teacher.style.map((item) => <li key={item.th}>{field(item)}</li>)}</ul>
    <div className="mc-section-title"><h2>{label('lessons')}</h2></div>
    <div className="mc-lessons">
      {lessonsFor(teacher.id).map((lesson) => {
        const status = statusOf(lesson, data);
        const href = status === 'locked' ? `/chat/unlock/${lesson.id}` : `/chat/t/${teacher.id}/${lesson.id}`;
        return <article className="mc-lesson" key={lesson.id}>
          <div>
            <div className="mc-meta">
              <span className={`mc-badge${lesson.free ? '' : ' paid'}`}>{lesson.free ? label('free') : `${label('samplePrice')} 2 USDC`}</span>
              <span className={`mc-badge ${status === 'passed' ? 'done' : status === 'locked' ? 'warn' : ''}`}>{label(statusLabel[status])}</span>
              <span>{field(lesson.level)}</span>
            </div>
            <h3>{field(lesson.title)}</h3>
            <p>{label('goal')}: {field(lesson.goal)}</p>
            <p>{label('passRule')}: {field(lesson.pass)}</p>
          </div>
          <Link className="mc-primary" to={href}>{status === 'locked' ? label('unlock') : label('openLesson')}</Link>
        </article>;
      })}
    </div>
  </>;
}

function LearningPage() {
  const { data } = useChat();
  const { label, field } = useLang();
  const rows = Object.keys(data.progress)
    .map((id) => ({ id, progress: data.progress[id] }))
    .sort((a, b) => (b.progress.updatedAt || 0) - (a.progress.updatedAt || 0));
  return <>
    <h1>{label('myLearning')}</h1>
    <p className="mc-lead">{label('myLearningLead')}</p>
    {rows.length === 0 ? <div className="mc-panel mc-stack" style={{ marginTop: 22 }}>
      <p>{label('emptyLearning')}</p>
      <Link className="mc-primary" to="/chat">{label('pickTeacher')}</Link>
    </div> : <div className="mc-lessons">
      {rows.map(({ id, progress }) => {
        const lesson = lessonById(id);
        if (!lesson) return null;
        const teacher = teacherById(lesson.teacherId);
        const open = isUnlocked(lesson, data);
        return <article className="mc-lesson" key={id}>
          <div>
            <div className="mc-subject">{field(teacher.name)} · {field(teacher.subject)}</div>
            <h3>{field(lesson.title)}</h3>
            <p>{progress.passed ? label('passed') : `${label('step')} ${progress.step + 1}`}</p>
          </div>
          <Link className="mc-primary" to={open ? `/chat/t/${teacher.id}/${lesson.id}` : `/chat/unlock/${lesson.id}`}>{open ? label('continueAction') : label('unlock')}</Link>
        </article>;
      })}
    </div>}
  </>;
}

function ProfilePage() {
  const { data, setName, connectWallet, disconnectWallet, reset } = useChat();
  const { label, field } = useLang();
  const unlocked = Object.entries(data.unlocks);
  return <>
    <h1>{label('profile')}</h1>
    <p className="mc-lead">{label('profileLead')}</p>
    <div className="mc-stack" style={{ marginTop: 22 }}>
      <section className="mc-panel">
        <form className="mc-form" onSubmit={(event) => event.preventDefault()}>
          <label htmlFor="mc-name">{label('displayName')}</label>
          <input id="mc-name" value={data.name} onChange={(event) => setName(event.target.value)} maxLength={40} />
        </form>
      </section>
      <section className="mc-panel">
        <h2>{label('wallet')}</h2>
        {data.wallet ? <>
          <p>{label('walletOn')}</p>
          <p className="mc-address">{data.wallet.address}</p>
          <button className="mc-ghost" type="button" onClick={disconnectWallet} style={{ marginTop: 12 }}>{label('disconnect')}</button>
        </> : <>
          <p>{label('walletOff')}</p>
          <button className="mc-primary" type="button" onClick={connectWallet} style={{ marginTop: 12 }}>{label('connect')}</button>
        </>}
      </section>
      <section className="mc-panel">
        <h2>{label('unlockedTitle')}</h2>
        {unlocked.length === 0 ? <p>{label('noUnlock')}</p> : <div className="mc-stack">
          {unlocked.map(([id, item]) => {
            const lesson = lessonById(id);
            if (!lesson) return null;
            return <p key={id}><strong>{field(lesson.title)}</strong><br />{label('until')} {new Date(item.until).toLocaleDateString(data.lang === 'en' ? 'en-GB' : 'th-TH')}</p>;
          })}
        </div>}
      </section>
      <button className="mc-ghost" type="button" onClick={reset}>{label('reset')}</button>
    </div>
  </>;
}

function Missing() {
  const { label } = useLang();
  return <div className="mc-panel"><h1>{label('notFound')}</h1><Link className="mc-primary" to="/chat">{label('backHome')}</Link></div>;
}

function ChatRoutes() {
  return <Routes>
    <Route path="t/:teacherId/:lessonId" element={<ChatRoom />} />
    <Route path="unlock/:lessonId" element={<Shell><UnlockPage /></Shell>} />
    <Route path="pay/:lessonId/result" element={<Shell><PayResultPage /></Shell>} />
    <Route path="learn" element={<Shell><LearningPage /></Shell>} />
    <Route path="profile" element={<Shell><ProfilePage /></Shell>} />
    <Route path="t/:teacherId" element={<Shell><TopicsPage /></Shell>} />
    <Route index element={<Shell><HomePage /></Shell>} />
    <Route path="*" element={<Shell><Missing /></Shell>} />
  </Routes>;
}

export function ChatApp() {
  return <ChatProvider><div className="mc-app"><ChatRoutes /></div></ChatProvider>;
}
