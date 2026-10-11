import { Prisma } from '@prisma/client';
import { CourseDetailDto } from './course-detail.dto';

export type CourseSummaryDto = Omit<CourseDetailDto,'description'|'outcomes'|'outline'>;
export const courseSummarySelect = {
  id:true,slug:true,title:true,subtitle:true,coverUrl:true,category:true,level:true,
  priceMinor:true,currency:true,publishedAt:true,
  instructor:{select:{id:true,displayName:true,avatarUrl:true}},
} satisfies Prisma.CourseSelect;
export type CourseSummaryRow = Prisma.CourseGetPayload<{select:typeof courseSummarySelect}>;
export function courseSummary(row:CourseSummaryRow):CourseSummaryDto {
  if (!row.publishedAt || row.currency !== 'THB' || (row.priceMinor !== null && row.priceMinor < 0)) throw Error('Invalid stored course summary');
  return {id:row.id,slug:row.slug,title:row.title,subtitle:row.subtitle,cover_url:row.coverUrl,
    category:row.category,level:row.level,price:row.priceMinor !== null && row.priceMinor > 0
      ? {amount_minor:row.priceMinor,currency:'THB'} : null,
    instructor:{id:row.instructor.id,display_name:row.instructor.displayName,avatar_url:row.instructor.avatarUrl},
    published_at:row.publishedAt.toISOString()};
}
