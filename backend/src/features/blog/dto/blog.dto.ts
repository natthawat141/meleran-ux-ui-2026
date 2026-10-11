import { Prisma } from '@prisma/client';
import { checkedDocument } from './blog-request.pipe';
export const summarySelect=Prisma.validator<Prisma.BlogPostSelect>()({id:true,slug:true,title:true,category:true,coverUrl:true,excerpt:true,readingMinutes:true,publishedAt:true,author:{select:{id:true,displayName:true}}});
export const detailSelect=Prisma.validator<Prisma.BlogPostSelect>()({...summarySelect,content:true,contentDoc:true});
export const adminSelect=Prisma.validator<Prisma.BlogPostSelect>()({...detailSelect,revision:true,status:true,authorId:true,editorId:true,createdAt:true,updatedAt:true});
type SummaryRow=Prisma.BlogPostGetPayload<{select:typeof summarySelect}>;
type DetailRow=Prisma.BlogPostGetPayload<{select:typeof detailSelect}>;
type AdminRow=Prisma.BlogPostGetPayload<{select:typeof adminSelect}>;
export function summary(row:SummaryRow){
  if(row.category===null||row.readingMinutes===null||row.readingMinutes<1)throw Error('Incomplete persisted Blog metadata');
  return {id:row.id,slug:row.slug,title:row.title,category:row.category,cover_url:row.coverUrl,excerpt:row.excerpt,reading_minutes:row.readingMinutes,
    published_at:row.publishedAt?.toISOString()??null,author:{id:row.author.id,display_name:row.author.displayName}};
}
export function detail(row:DetailRow){if(row.content===null)throw Error('Incomplete persisted Blog content');
  try{checkedDocument(row.contentDoc);}catch{throw Error('Invalid persisted Blog document');}
  return {...summary(row),content:row.content,content_doc:row.contentDoc};}
export function adminView(row:AdminRow){if(!row.editorId||row.revision<1||!['draft','published'].includes(row.status))throw Error('Incomplete persisted Blog audit');
  return {...detail(row),revision:row.revision,status:row.status,author_id:row.authorId,editor_id:row.editorId,created_at:row.createdAt.toISOString(),updated_at:row.updatedAt.toISOString()};}
