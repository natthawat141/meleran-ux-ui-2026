import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ApiException } from '../../shared/errors/api-exception';
import { PublicInstructorDto, publicBio } from './dto/public-instructor.dto';

@Injectable()
export class PublicInstructorService {
  constructor(private readonly prisma: PrismaService) {}

  async getById(id: string): Promise<PublicInstructorDto> {
    const account = await this.prisma.account.findFirst({
      where: { id, roleGrants: { some: { role: 'instructor' } } },
      select: { id: true, displayName: true, avatarUrl: true, profileJson: true },
    });
    if (!account) throw ApiException.notFound('ไม่พบผู้สอน');
    return { id: account.id, display_name: account.displayName,
      avatar_url: account.avatarUrl, bio: publicBio(account.profileJson) };
  }
}
