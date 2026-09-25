import React from 'react';
import { ArrowRightOutlined } from '@ant-design/icons';
import { Link } from 'react-router-dom';
import { blogCoverFor } from '../../data.js';

export function ReadingCollection({ posts }) {
  const readings = [...posts].sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt)).slice(0, 2);
  if (!readings.length) return null;
  return <section id="reading" className="home-container home-section home-readings" aria-labelledby="home-reading-title">
    <div className="home-section-heading"><div><h2 id="home-reading-title">เติมไอเดีย ก่อนเริ่มเรียน</h2><p>บทความที่เปิดอ่านได้เลย โดยไม่ต้องสมัครสมาชิก</p></div><Link to="/articles" className="home-text-link">บทความทั้งหมด <ArrowRightOutlined aria-hidden="true" /></Link></div>
    <div className="home-reading-grid">{readings.map((post) => <article key={post.id} className="home-reading-item">
      <Link to={`/articles/${post.id}`} className="home-editorial-photo home-reading-photo"><img src={post.cover || blogCoverFor(post.coverKey)} alt="" loading="lazy" /></Link>
      <div className="home-reading-copy">
        <p className="home-reading-meta">{post.category} · อ่าน {post.readingMinutes ?? 3} นาที</p>
        <h3><Link to={`/articles/${post.id}`}>{post.title}</Link></h3>
        <p className="home-reading-excerpt">{post.excerpt}</p>
        <Link to={`/articles/${post.id}`} className="home-text-link">อ่านบทความ <ArrowRightOutlined aria-hidden="true" /></Link>
      </div>
    </article>)}</div>
  </section>;
}
