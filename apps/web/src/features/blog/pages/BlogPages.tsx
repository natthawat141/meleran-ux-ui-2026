import React, { useEffect, useMemo, useState } from 'react';
import { ConfigProvider, Input, Segmented, Table, type TableProps } from 'antd';
import { AppstoreOutlined, ArrowLeftOutlined, ArrowRightOutlined, SearchOutlined, UnorderedListOutlined } from '@ant-design/icons';
import { Link, useParams } from 'react-router-dom';
import { useLms } from '@melearn/store';
import { LandingFooter, LandingHeader, RichDocument, blogCoverFor, landingTheme } from '@melearn/ui';
import type { BlogPost, User } from '@melearn/contracts';
import '@melearn/ui/styles/landing.css';
import '../styles/blog.css';

const dateLabel = (value?: string | null) =>
  value
    ? new Date(value).toLocaleDateString('th-TH', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : '';

const newestFirst = (a: BlogPost, b: BlogPost) =>
  new Date(b.publishedAt ?? b.updatedAt ?? 0).getTime() -
  new Date(a.publishedAt ?? a.updatedAt ?? 0).getTime();

interface BlogShellProps {
  children: React.ReactNode;
  title: string;
}

function BlogShell({ children, title }: BlogShellProps) {
  useEffect(() => {
    const previous = document.title;
    document.title = `${title} | melearn`;
    return () => {
      document.title = previous;
    };
  }, [title]);

  return (
    <ConfigProvider theme={landingTheme}>
      <div className="home-v3 blog-site">
        <a className="home-skip" href="#blog-main">ข้ามไปเนื้อหาหลัก</a>
        <LandingHeader />
        <main id="blog-main" tabIndex={-1}>{children}</main>
        <LandingFooter />
      </div>
    </ConfigProvider>
  );
}

interface PostMetaProps {
  post: BlogPost;
  author?: User;
}

function PostMeta({ post, author }: PostMetaProps) {
  return (
    <div className="blog-post-meta">
      <span>{post.category}</span>
      <span aria-hidden="true">·</span>
      <span>{dateLabel(post.publishedAt)}</span>
      <span aria-hidden="true">·</span>
      <span>อ่าน {post.readingMinutes ?? 3} นาที</span>
      {author && (
        <>
          <span aria-hidden="true">·</span>
          <span>โดย {author.name}</span>
        </>
      )}
    </div>
  );
}

export function BlogIndexPage() {
  const { data } = useLms();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('ทั้งหมด');
  const [view, setView] = useState<'card' | 'table'>('card');
  const posts = useMemo(
    () => [...data.blogPosts.filter((post) => post.status === 'published')].sort(newestFirst),
    [data.blogPosts]
  );
  const categories = ['ทั้งหมด', ...new Set(posts.map((post) => post.category))];
  const filtered = posts.filter(
    (post) =>
      (category === 'ทั้งหมด' || post.category === category) &&
      `${post.title} ${post.excerpt} ${post.category}`
        .toLocaleLowerCase('th-TH')
        .includes(query.toLocaleLowerCase('th-TH').trim())
  );
  const featured = view === 'card' && !query && category === 'ทั้งหมด' ? filtered[0] : null;
  const rest = featured ? filtered.slice(1) : filtered;

  const tableColumns: TableProps<BlogPost>['columns'] = [
    {
      title: 'บทความ',
      render: (_, post) => <Link to={`/articles/${post.id}`}>{post.title}</Link>,
    },
    { title: 'หมวดหมู่', dataIndex: 'category' },
    {
      title: 'เผยแพร่',
      render: (_, post) => dateLabel(post.publishedAt),
    },
    {
      title: 'เวลาอ่าน',
      render: (_, post) => `${post.readingMinutes ?? 3} นาที`,
    },
  ];

  return (
    <BlogShell title="บทความ">
      <div className="blog-container blog-index">
        <header className="blog-index-intro">
          <p className="blog-eyebrow">MELEARN JOURNAL</p>
          <h1>บทความสำหรับทุกความอยากรู้</h1>
          <p>ไอเดียและวิธีคิดสั้น ๆ ที่อ่านได้เลย ไม่ต้องสมัครสมาชิก</p>
        </header>
        {featured && (
          <Link to={`/articles/${featured.id}`} className="blog-featured">
            <div className="blog-featured-image">
              <img src={featured.cover || blogCoverFor(featured.coverKey)} alt="" />
            </div>
            <div className="blog-featured-copy">
              <span className="blog-featured-kicker">บทความแนะนำ</span>
              <PostMeta post={featured} />
              <h2>{featured.title}</h2>
              <p>{featured.excerpt}</p>
              <span className="blog-read-link">
                อ่านบทความ <ArrowRightOutlined aria-hidden="true" />
              </span>
            </div>
          </Link>
        )}
        <section aria-labelledby="blog-all-title" className="blog-list-section">
          <div className="blog-section-head">
            <div>
              <h2 id="blog-all-title">สำรวจบทความ</h2>
              <p>เลือกเรื่องที่สนใจ แล้วค่อย ๆ อ่านในจังหวะของคุณ</p>
            </div>
            <Input
              className="blog-search"
              prefix={<SearchOutlined aria-hidden="true" />}
              placeholder="ค้นหาบทความ"
              aria-label="ค้นหาบทความ"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              allowClear
            />
          </div>
          <div className="blog-view-bar">
            <div className="blog-filters" role="group" aria-label="หมวดบทความ">
              {categories.map((item) => (
                <button
                  key={item}
                  type="button"
                  className={category === item ? 'is-active' : ''}
                  aria-pressed={category === item}
                  onClick={() => setCategory(item)}
                >
                  {item}
                </button>
              ))}
            </div>
            <Segmented
              aria-label="มุมมองบทความ"
              value={view}
              onChange={(val) => setView(val as 'card' | 'table')}
              options={[
                { value: 'card', label: 'การ์ด', icon: <AppstoreOutlined /> },
                { value: 'table', label: 'ตาราง', icon: <UnorderedListOutlined /> },
              ]}
            />
          </div>
          {view === 'table' ? (
            <Table
              rowKey="id"
              dataSource={filtered}
              pagination={{ pageSize: 8 }}
              scroll={{ x: 600 }}
              columns={tableColumns}
              locale={{ emptyText: 'ไม่พบบทความที่ตรงกับคำค้น' }}
            />
          ) : rest.length ? (
            <div className="blog-card-grid">
              {rest.map((post) => (
                <Link to={`/articles/${post.id}`} className="blog-card" key={post.id}>
                  <img src={post.cover || blogCoverFor(post.coverKey)} alt="" loading="lazy" />
                  <div className="blog-card-copy">
                    <PostMeta post={post} />
                    <h3>{post.title}</h3>
                    <p>{post.excerpt}</p>
                    <span className="blog-read-link">
                      อ่านบทความ <ArrowRightOutlined aria-hidden="true" />
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="blog-empty">ไม่พบบทความที่ตรงกับคำค้น ลองเลือกหมวดอื่นหรือเปลี่ยนคำค้นหา</div>
          )}
        </section>
      </div>
    </BlogShell>
  );
}

export function BlogArticlePage() {
  const { id } = useParams<{ id: string }>();
  const { data } = useLms();
  const post = data.blogPosts.find((item) => item.id === id);

  if (!post || post.status !== 'published') {
    return (
      <BlogShell title="ไม่พบบทความ">
        <div className="blog-container blog-missing">
          <h1>ไม่พบบทความนี้</h1>
          <p>บทความอาจยังไม่เผยแพร่ หรือถูกลบไปแล้ว</p>
          <Link to="/articles" className="blog-read-link">
            <ArrowLeftOutlined aria-hidden="true" /> กลับไปหน้าบทความ
          </Link>
        </div>
      </BlogShell>
    );
  }

  const author = data.users.find((user) => user.id === post.authorId);
  const related = data.blogPosts
    .filter((item) => item.status === 'published' && item.id !== id)
    .sort(newestFirst)
    .slice(0, 2);

  return (
    <BlogShell title={post.title}>
      <article className="blog-article">
        <div className="blog-article-heading">
          <Link className="blog-back" to="/articles">
            <ArrowLeftOutlined aria-hidden="true" /> บทความทั้งหมด
          </Link>
          <PostMeta post={post} author={author} />
          <h1>{post.title}</h1>
          <p>{post.excerpt}</p>
        </div>
        <div className="blog-article-cover">
          <img src={post.cover || blogCoverFor(post.coverKey)} alt="" />
        </div>
        <div className="blog-article-body">
          <RichDocument document={post.bodyDoc} text={post.body} />
        </div>
        <div className="blog-article-end">
          <span>อ่านจบแล้ว ลองนำหนึ่งไอเดียไปใช้ในวันนี้</span>
          <Link to="/articles">
            ดูบทความอื่น <ArrowRightOutlined aria-hidden="true" />
          </Link>
        </div>
      </article>
      {!!related.length && (
        <section className="blog-container blog-related" aria-labelledby="blog-related-title">
          <div className="blog-section-head">
            <div>
              <h2 id="blog-related-title">อ่านต่ออีกนิด</h2>
              <p>เรื่องอื่น ๆ ที่อาจทำให้คุณได้ไอเดียใหม่</p>
            </div>
            <Link className="blog-read-link" to="/articles">
              บทความทั้งหมด <ArrowRightOutlined aria-hidden="true" />
            </Link>
          </div>
          <div className="blog-card-grid">
            {related.map((item) => (
              <Link to={`/articles/${item.id}`} className="blog-card" key={item.id}>
                <img src={item.cover || blogCoverFor(item.coverKey)} alt="" loading="lazy" />
                <div className="blog-card-copy">
                  <PostMeta post={item} />
                  <h3>{item.title}</h3>
                  <p>{item.excerpt}</p>
                  <span className="blog-read-link">
                    อ่านบทความ <ArrowRightOutlined aria-hidden="true" />
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}
    </BlogShell>
  );
}
