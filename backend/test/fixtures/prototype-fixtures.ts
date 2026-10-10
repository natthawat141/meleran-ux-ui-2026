import { PrismaService } from '../../src/prisma/prisma.service';
import * as crypto from 'crypto';

export async function seedInitialData(prisma: PrismaService) {
  const accountCount = await prisma.account.count();
  if (accountCount > 0) return;

  function hashPassword(password: string): string {
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
    return `${salt}:${hash}`;
  }

  // Admin
  const admin = await prisma.account.create({
    data: {
      username: 'admin',
      normalizedUsername: 'ADMIN',
      displayName: 'Administrator',
      roles: 'admin',
      origin: 'admin_created',
      localCredential: {
        create: {
          passwordHash: hashPassword('test-password-123'),
        },
      },
    },
  });

  // Learner
  const learner = await prisma.account.create({
    data: {
      username: 'learner',
      normalizedUsername: 'LEARNER',
      displayName: 'Learner One',
      roles: 'learner',
      origin: 'admin_created',
      localCredential: {
        create: {
          passwordHash: hashPassword('test-password-123'),
        },
      },
    },
  });

  // Instructor
  const instructor = await prisma.account.create({
    data: {
      username: 'instructor',
      normalizedUsername: 'INSTRUCTOR',
      displayName: 'Prof. Melearn',
      roles: 'instructor',
      origin: 'admin_created',
      localCredential: {
        create: {
          passwordHash: hashPassword('test-password-123'),
        },
      },
    },
  });

  // Courses
  await prisma.course.create({
    data: {
      title: 'Free Course - Math 101',
      slug: 'free',
      category: 'math',
      level: 'beginner',
      status: 'published',
      publishedAt: new Date(),
      priceMinor: null,
      instructorId: instructor.id,
      description: 'A free course for beginners',
      outcomesJson: '["Understand basic math","Solve equations"]',
      chapters: {
        create: [
          {
            title: 'Chapter 1: Getting Started',
            position: 0,
            items: {
              create: [
                { title: 'Article: Introduction', type: 'article', position: 0 },
                { title: 'Video: Basics', type: 'video', position: 1 },
              ],
            },
          },
        ],
      },
    },
  });

  await prisma.course.create({
    data: {
      title: 'Paid Course - Advanced AI',
      slug: 'paid',
      category: 'technology',
      level: 'advanced',
      status: 'published',
      publishedAt: new Date(),
      priceMinor: 199000,
      instructorId: instructor.id,
      description: 'Comprehensive AI Course',
    },
  });

  await prisma.course.create({
    data: {
      title: 'Draft Course - In Progress',
      slug: 'draft',
      category: 'technology',
      level: 'beginner',
      status: 'draft',
      instructorId: instructor.id,
    },
  });
}
