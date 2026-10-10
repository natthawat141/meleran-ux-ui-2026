import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { configureApplication } from '../src/bootstrap';
import { prepareTestDatabase } from './support/test-database';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { seedInitialData } from './fixtures/prototype-fixtures';

describe('Melearn NestJS API - 13 Operations E2E', () => {
  jest.setTimeout(30000);

  let app: INestApplication;
  let prisma: PrismaService;
  let learnerCookie: string;
  let adminCookie: string;
  let freeCourseId: string;

  beforeAll(async () => {
    prepareTestDatabase();
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    configureApplication(app, ['http://localhost:3000', 'http://localhost:3001']);
    await app.init();

    prisma = app.get(PrismaService);
    await prisma.enrollment.deleteMany();
    await prisma.courseItem.deleteMany();
    await prisma.courseChapter.deleteMany();
    await prisma.course.deleteMany();
    await prisma.externalIdentity.deleteMany();
    await prisma.appSession.deleteMany();
    await prisma.localCredential.deleteMany();
    await prisma.account.deleteMany();
    await seedInitialData(prisma);
  });

  afterAll(async () => {
    if (app) await app.close();
  });

  // -------------------------------------------------------------
  // 1. POST /api/v1/auth/login
  // -------------------------------------------------------------
  it('01. POST /api/v1/auth/login - should authenticate learner and admin and reject wrong credentials', async () => {
    // Learner login
    const resLearner = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .set('x-melearn-app', 'web')
      .send({
        identifier: 'learner',
        password: 'test-password-123',
        audience: 'web',
      })
      .expect(200);

    expect(resLearner.body.user.username).toBe('learner');
    const setCookie = resLearner.headers['set-cookie'];
    expect(setCookie).toBeDefined();
    learnerCookie = setCookie[0].split(';')[0];

    // Admin login
    const resAdmin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .set('x-melearn-app', 'admin')
      .send({
        identifier: 'admin',
        password: 'test-password-123',
        audience: 'admin',
      })
      .expect(200);

    expect(resAdmin.body.user.username).toBe('admin');
    adminCookie = resAdmin.headers['set-cookie'][0].split(';')[0];

    // Wrong password
    await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .set('x-melearn-app', 'web')
      .send({
        identifier: 'learner',
        password: 'wrong-password',
        audience: 'web',
      })
      .expect(401);
  });

  // -------------------------------------------------------------
  // 2. POST /api/v1/auth/logout
  // -------------------------------------------------------------
  it('02. POST /api/v1/auth/logout - should revoke session', async () => {
    // Login temporary user
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .set('x-melearn-app', 'web')
      .send({
        identifier: 'learner',
        password: 'test-password-123',
        audience: 'web',
      })
      .expect(200);
    const cookie = res.headers['set-cookie'][0].split(';')[0];

    // Logout
    await request(app.getHttpServer())
      .post('/api/v1/auth/logout')
      .set('Cookie', cookie)
      .expect(204);

    // After logout, calling /me should be 401
    await request(app.getHttpServer())
      .get('/api/v1/me')
      .set('Cookie', cookie)
      .expect(401);
  });

  // -------------------------------------------------------------
  // 3. GET /api/v1/me
  // -------------------------------------------------------------
  it('03. GET /api/v1/me - should return current user profile', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/me')
      .set('Cookie', learnerCookie)
      .expect(200);

    expect(res.body.username).toBe('learner');
    expect(res.body.roles).toContain('learner');
    expect(res.body.profile).toBeDefined();
    expect(res.body.auth_methods).toBeDefined();
  });

  // -------------------------------------------------------------
  // 4. PATCH /api/v1/me
  // -------------------------------------------------------------
  it('04. PATCH /api/v1/me - should update profile information', async () => {
    const res = await request(app.getHttpServer())
      .patch('/api/v1/me')
      .set('Cookie', learnerCookie)
      .send({
        display_name: 'Nest Learner Updated',
        profile: {
          bio: 'Writing code in NestJS',
        },
      })
      .expect(200);

    expect(res.body.display_name).toBe('Nest Learner Updated');
    expect(res.body.profile.bio).toBe('Writing code in NestJS');
  });

  // -------------------------------------------------------------
  // 5. GET /api/v1/admin/users
  // -------------------------------------------------------------
  it('05. GET /api/v1/admin/users - should list users for admin', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/admin/users?limit=10')
      .set('Cookie', adminCookie)
      .set('x-melearn-app', 'admin')
      .expect(200);

    expect(Array.isArray(res.body.items)).toBe(true);
    expect(res.body.items.length).toBeGreaterThanOrEqual(3);
  });

  // -------------------------------------------------------------
  // 6. POST /api/v1/admin/users
  // -------------------------------------------------------------
  it('06. POST /api/v1/admin/users - should create new user', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/admin/users')
      .set('Cookie', adminCookie)
      .set('x-melearn-app', 'admin')
      .send({
        username: 'nest_student_1',
        password: 'secure_password_123',
        display_name: 'Nest Student 1',
      })
      .expect(201);

    expect(res.body.user.username).toBe('nest_student_1');
    expect(res.body.created_by).toBeDefined();
  });

  // -------------------------------------------------------------
  // 7. GET /api/v1/admin/users/:id
  // -------------------------------------------------------------
  it('07. GET /api/v1/admin/users/:id - should get user details', async () => {
    const listRes = await request(app.getHttpServer())
      .get('/api/v1/admin/users?q=learner')
      .set('Cookie', adminCookie)
      .set('x-melearn-app', 'admin')
      .expect(200);

    const learnerId = listRes.body.items[0].id;

    const res = await request(app.getHttpServer())
      .get(`/api/v1/admin/users/${learnerId}`)
      .set('Cookie', adminCookie)
      .set('x-melearn-app', 'admin')
      .expect(200);

    expect(res.body.id).toBe(learnerId);
    expect(res.body.auth_methods).toBeDefined();
  });

  // -------------------------------------------------------------
  // 8. POST /api/v1/admin/users/:id/instructor
  // -------------------------------------------------------------
  it('08. POST /api/v1/admin/users/:id/instructor - should assign instructor role', async () => {
    const userRes = await request(app.getHttpServer())
      .post('/api/v1/admin/users')
      .set('Cookie', adminCookie)
      .set('x-melearn-app', 'admin')
      .send({
        username: 'candidate_teacher',
        password: 'secure_password_123',
        display_name: 'Candidate Teacher',
      })
      .expect(201);

    const userId = userRes.body.user.id;

    const res = await request(app.getHttpServer())
      .post(`/api/v1/admin/users/${userId}/instructor`)
      .set('Cookie', adminCookie)
      .set('x-melearn-app', 'admin')
      .send({})
      .expect(200);

    expect(res.body.user.roles).toContain('instructor');
    expect(res.body.added_by).toBeDefined();
  });

  // -------------------------------------------------------------
  // 9. GET /api/v1/admin/instructors
  // -------------------------------------------------------------
  it('09. GET /api/v1/admin/instructors - should list instructors', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/admin/instructors')
      .set('Cookie', adminCookie)
      .set('x-melearn-app', 'admin')
      .expect(200);

    expect(Array.isArray(res.body.items)).toBe(true);
    expect(res.body.items.length).toBeGreaterThanOrEqual(1);
  });

  // -------------------------------------------------------------
  // 10. GET /api/v1/courses
  // -------------------------------------------------------------
  it('10. GET /api/v1/courses - should list published courses', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/courses')
      .expect(200);

    expect(Array.isArray(res.body.items)).toBe(true);
    expect(res.body.items.length).toBeGreaterThanOrEqual(2);
    // Should not contain draft
    expect(res.body.items.some((c: any) => c.slug === 'draft')).toBe(false);

    // Save free course ID for next tests
    const freeCourse = res.body.items.find((c: any) => c.slug === 'free');
    expect(freeCourse).toBeDefined();
    freeCourseId = freeCourse.id;
  });

  // -------------------------------------------------------------
  // 11. GET /api/v1/courses/:id
  // -------------------------------------------------------------
  it('11. GET /api/v1/courses/:id - should get course details with outline', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/courses/${freeCourseId}`)
      .expect(200);

    expect(res.body.slug).toBe('free');
    expect(Array.isArray(res.body.outline)).toBe(true);
    expect(res.body.outline[0].items[0].type).toBe('article');
  });

  // -------------------------------------------------------------
  // 12. POST /api/v1/courses/:id/enroll
  // -------------------------------------------------------------
  it('12. POST /api/v1/courses/:id/enroll - should enroll free course idempotently', async () => {
    // 1st enroll
    const res1 = await request(app.getHttpServer())
      .post(`/api/v1/courses/${freeCourseId}/enroll`)
      .set('Cookie', learnerCookie)
      .expect(200);

    expect(res1.body.access).toBe('lifetime');
    const enrollId = res1.body.id;

    // 2nd enroll (idempotent)
    const res2 = await request(app.getHttpServer())
      .post(`/api/v1/courses/${freeCourseId}/enroll`)
      .set('Cookie', learnerCookie)
      .expect(200);

    expect(res2.body.id).toBe(enrollId);
  });

  // -------------------------------------------------------------
  // 13. GET /api/v1/me/enrollments
  // -------------------------------------------------------------
  it('13. GET /api/v1/me/enrollments - should return user enrollments with progress', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/me/enrollments')
      .set('Cookie', learnerCookie)
      .expect(200);

    expect(Array.isArray(res.body.items)).toBe(true);
    expect(res.body.items.length).toBeGreaterThanOrEqual(1);
    expect(res.body.items[0].enrollment.course_id).toBe(freeCourseId);
    expect(res.body.items[0].progress.total_items).toBeGreaterThanOrEqual(2);
  });
});
