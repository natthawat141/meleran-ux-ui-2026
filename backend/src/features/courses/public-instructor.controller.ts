import { Controller, Get, Param } from '@nestjs/common';
import { Public } from '../../shared/auth/session.guard';
import { PublicInstructorService } from './public-instructor.service';

@Controller('instructors')
export class PublicInstructorController {
  constructor(private readonly instructors: PublicInstructorService) {}

  @Public()
  @Get(':id')
  getById(@Param('id') id: string) { return this.instructors.getById(id); }
}
