import { Controller, Get, Param, Query } from '@nestjs/common';
import { Public } from '../../shared/auth/session.guard';
import { PublicInstructorService } from './public-instructor.service';
import { CatalogListService } from './catalog-list.service';
import { PageQuery, PageQueryPipe } from '../../shared/pagination/keyset';

@Controller('instructors')
export class PublicInstructorController {
  constructor(private readonly instructors: PublicInstructorService, private readonly catalog: CatalogListService) {}

  @Public()
  @Get(':id/courses')
  courses(@Param('id') id: string, @Query(new PageQueryPipe()) query: PageQuery) {
    return this.catalog.list(query,id);
  }

  @Public()
  @Get(':id')
  getById(@Param('id') id: string) { return this.instructors.getById(id); }
}
