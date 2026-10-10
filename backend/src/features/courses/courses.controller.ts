import { Controller, Get, Param, Query } from '@nestjs/common';
import { CoursesService } from './courses.service';
import { Public } from '../../shared/auth/session.guard';

@Controller('courses')
export class CoursesController {
  constructor(private readonly coursesService: CoursesService) {}

  @Public()
  @Get()
  async list(
    @Query('q') q?: string,
    @Query('category') category?: string,
    @Query('level') level?: string,
    @Query('price_type') priceType?: string,
    @Query('limit') limit = 20,
    @Query('cursor') cursor?: string,
  ) {
    return this.coursesService.list(q, category, level, priceType, Number(limit), cursor);
  }

  @Public()
  @Get(':id')
  async getById(@Param('id') id: string) {
    return this.coursesService.getById(id);
  }
}
