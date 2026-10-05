import React, { useState } from 'react';
import { Tabs } from 'antd';
import { ArrowRightOutlined, BookOutlined, ClockCircleOutlined } from '@ant-design/icons';
import { Link } from 'react-router-dom';
import { landingCover } from './LandingArtwork';
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
    <section id="reading" className="home-container home-section home-articles-new" aria-labelledby="home-reading-title">
      <div className="home-collection-heading">
        <div>
          <p className="home-landing-kicker">KNOWLEDGE HUB</p>
          <h2 id="home-reading-title">ไอเดียดี ๆ<span>เพื่อการเรียนรู้</span></h2>
          <p>เติมเทคนิค มุมมอง และแรงบันดาลใจสำหรับเรื่องที่คุณอยากเรียน</p>
        </div>
        <Link to="/articles" className="home-collection-link">บทความทั้งหมด <ArrowRightOutlined aria-hidden="true" /></Link>
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
      <div className="home-article-cards">
        {readings.map((post) => (
          <article key={post.id} className="home-article-card">
            <Link to={`/articles/${post.id}`} className="home-article-cover">
              <img src={landingCover(post.cover, post.coverKey)} alt="" loading="lazy" />
            </Link>
            <div className="home-article-body">
              <span className="home-article-category">{post.category}</span>
              <h3><Link to={`/articles/${post.id}`}>{post.title}</Link></h3>
              <p className="home-article-excerpt">{post.excerpt}</p>
              <p className="home-article-meta"><ClockCircleOutlined aria-hidden="true" /> อ่าน {post.readingMinutes ?? 3} นาที</p>
              <Link to={`/articles/${post.id}`} className="home-collection-link">อ่านบทความ <ArrowRightOutlined aria-hidden="true" /></Link>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
