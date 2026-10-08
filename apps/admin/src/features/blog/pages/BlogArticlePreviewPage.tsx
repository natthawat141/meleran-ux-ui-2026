import React, { useEffect } from 'react';
import { ArrowLeftOutlined, ArrowRightOutlined } from '@ant-design/icons';
import { Link, useParams } from 'react-router-dom';
import { useLms } from '@legacy/store';
import { RichDocument, WorkspaceShell, blogCoverFor } from '@melearn/ui';
import type { BlogPost, User } from '@melearn/contracts';
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

function BlogShell({ children, title }: { children: React.ReactNode; title: string }) {
  useEffect(() => {
    const previous = document.title;
    document.title = `${title} | melearn`;
    return () => {
      document.title = previous;
    };
  }, [title]);

  return (
    <WorkspaceShell availableRoles={['admin']}>
      <div className="blog-site" style={{ padding: '24px 0' }}>
        <main id="blog-main" tabIndex={-1}>{children}</main>
      </div>
    </WorkspaceShell>
  );
}

function PostMeta({ post, author }: { post: BlogPost; author?: User }) {
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

export function BlogArticlePreviewPage() {
  const { id } = useParams<{ id: string }>();
  const { data, currentUser } = useLms();
  const post = data.blogPosts.find((item) => item.id === id);

  if (!post || (post.status !== 'published' && currentUser?.role !== 'admin')) {
    return (
      <BlogShell title="ไม่พบบทความ">
        <div className="blog-container blog-missing">
          <h1>ไม่พบบทความนี้</h1>
          <p>บทความอาจยังไม่เผยแพร่ หรือถูกลบไปแล้ว</p>
          <Link to="/admin/articles" className="blog-read-link">
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
          <Link className="blog-back" to="/admin/articles">
            <ArrowLeftOutlined aria-hidden="true" /> บทความทั้งหมด
          </Link>
          {post.status === 'draft' && <span className="blog-draft-label">ตัวอย่างฉบับร่าง · แอดมินเท่านั้น</span>}
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
          <Link to="/admin/articles">
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
            <Link className="blog-read-link" to="/admin/articles">
              บทความทั้งหมด <ArrowRightOutlined aria-hidden="true" />
            </Link>
          </div>
          <div className="blog-card-grid">
            {related.map((item) => (
              <Link to={`/articles/${item.id}`} className="blog-card" key={item.id}>
                <img src={item.cover || blogCoverFor(item.coverKey)} alt="" />
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
