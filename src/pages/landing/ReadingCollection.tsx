import React, { useState } from 'react';
import { Tabs } from 'antd';
import { ArrowRightOutlined, BookOutlined, ClockCircleOutlined } from '@ant-design/icons';
import { Link } from 'react-router-dom';
import { blogCoverFor } from '../../data';
import type { BlogPost } from '../../types';

export interface ReadingCollectionProps {
  posts: BlogPost[];
}

export function ReadingCollection({ posts }: ReadingCollectionProps) {
  const [category, setCategory] = useState('all');
  const categories = [...new Set(posts.map((post) => post.category))];
  const selectedCategory = categories.includes(category) ? category : 'all';
  const readings = [...posts]
    .filter((post) => selectedCategory === 'all' || post.category === selectedCategory)
    .sort((a, b) => new Date(b.publishedAt || 0).getTime() - new Date(a.publishedAt || 0).getTime())
    .slice(0, 3);

  if (!readings.length) return null;

  return (
    <section id="reading" className="home-container home-section home-readings" aria-labelledby="home-reading-title">
      <div className="home-section-heading">
        <div>
          <p className="home-landing-kicker">KNOWLEDGE HUB</p>
          <h2 id="home-reading-title">บทความ<span>เพื่อการเรียนรู้</span></h2>
          <p>บทความที่เปิดอ่านได้เลย โดยไม่ต้องสมัครสมาชิก</p>
        </div>
        <Link to="/articles" className="home-text-link">บทความทั้งหมด <ArrowRightOutlined aria-hidden="true" /></Link>
      </div>
      <Tabs
        className="home-reading-categories"
        activeKey={selectedCategory}
        onChange={setCategory}
        aria-label="หมวดหมู่บทความ"
        items={[
          { key: 'all', label: <><BookOutlined aria-hidden="true" /> บทความแนะนำ</> },
          ...categories.map((name) => ({ key: name, label: name })),
        ]}
      />
      <div className="home-reading-grid">
        {readings.map((post) => (
          <article key={post.id} className="home-reading-item">
            <Link to={`/articles/${post.id}`} className="home-editorial-photo home-reading-photo">
              <img src={post.cover || blogCoverFor(post.coverKey)} alt="" loading="lazy" />
            </Link>
            <div className="home-reading-copy">
              <span className="home-reading-category">{post.category}</span>
              <h3><Link to={`/articles/${post.id}`}>{post.title}</Link></h3>
              <p className="home-reading-excerpt">{post.excerpt}</p>
              <p className="home-reading-meta"><ClockCircleOutlined aria-hidden="true" /> อ่าน {post.readingMinutes ?? 3} นาที</p>
              <Link to={`/articles/${post.id}`} className="home-text-link">อ่านบทความ <ArrowRightOutlined aria-hidden="true" /></Link>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
