import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ApiException } from '../../shared/errors/api-exception';
import { Page, PageQuery, decodeCursor, page } from '../../shared/pagination/keyset';
import { CourseSummaryDto, courseSummary, courseSummarySelect } from './dto/course-summary.dto';
import { CourseDetailDto, storedItemType, storedOutcomes } from './dto/course-detail.dto';

@Injectable()
export class CatalogListService {
  constructor(private readonly prisma:PrismaService) {}
  async list(query:PageQuery,instructorId?:string):Promise<Page<CourseSummaryDto | CourseDetailDto>> {
    const route = instructorId === undefined ? 'catalog' : 'instructor-courses';
    const {q,category,level,price_type:price} = query.filters;
    if (price !== undefined && !['free','paid'].includes(price)) throw ApiException.validationFailed('price_type ไม่ถูกต้อง');
    const cursor = decodeCursor(route,query,instructorId);
    // One snapshot covers instructor eligibility and scoped page projection.
    return this.prisma.$transaction(async tx => {
      if (instructorId !== undefined && !await tx.account.findFirst({where:{id:instructorId,
        roleGrants:{some:{role:'instructor'}}},select:{id:true}})) throw ApiException.notFound('ไม่พบผู้สอน');
      const where:Prisma.CourseWhereInput = {status:'published',publishedAt:{not:null},
        ...(instructorId !== undefined ? {instructorId} : {}),
        ...(q ? {title:{contains:q,mode:'insensitive'}} : {}),
        ...(category !== undefined ? {category} : {}),...(level !== undefined ? {level} : {})};
      const conditions:Prisma.CourseWhereInput[] = [];
      if (price === 'free') conditions.push({OR:[{priceMinor:null},{priceMinor:0}]});
      if (price === 'paid') conditions.push({priceMinor:{gt:0}});
      if (cursor) conditions.push({OR:[{publishedAt:{lt:cursor.at}},{publishedAt:cursor.at,id:{gt:cursor.id}}]});
      if (conditions.length) where.AND = conditions;
      const rows = await tx.course.findMany({where,select:{...courseSummarySelect,
        description:true,outcomesJson:true,chapters:{orderBy:{position:'asc'},select:{id:true,title:true,
          items:{orderBy:{position:'asc'},select:{id:true,title:true,type:true}}}}},
        orderBy:[{publishedAt:'desc'},{id:'asc'}],take:query.limit+1});
      return page(route,query,rows,row=>({id:row.id,at:row.publishedAt!}),row=>instructorId===undefined?courseSummary(row):{
        ...courseSummary(row),description:row.description,outcomes:storedOutcomes(row.outcomesJson),
        outline:row.chapters.map(ch=>({id:ch.id,title:ch.title,items:ch.items.map(item=>({id:item.id,title:item.title,type:storedItemType(item.type)}))})),
      },instructorId);
    },{isolationLevel:Prisma.TransactionIsolationLevel.RepeatableRead});
  }
}
