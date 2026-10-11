import { Controller, Get, Param, Query } from '@nestjs/common';
import { CoursesService } from './courses.service';
import { Public } from '../../shared/auth/session.guard';
import { CatalogListService } from './catalog-list.service';
import { PageQuery, PageQueryPipe } from '../../shared/pagination/keyset';

@Controller('courses')
export class CoursesController {
  constructor(private readonly coursesService: CoursesService, private readonly catalog: CatalogListService) {}

  @Public()
  @Get()
  async list(@Query(new PageQueryPipe(['q','category','level','price_type'])) query: PageQuery) {
    return this.catalog.list(query);
  }

  @Public()
  @Get(':id')
  async getById(@Param('id') id: string) {
    return this.coursesService.getById(id);
  }
}
