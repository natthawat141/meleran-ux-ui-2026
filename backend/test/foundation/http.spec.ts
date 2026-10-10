import { Body, Controller, Get, HttpCode, INestApplication, InternalServerErrorException, Logger, Post } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { IsString, ValidateIf, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import * as request from 'supertest';
import { AppModule } from '../../src/app.module';
import { configureApplication } from '../../src/bootstrap';
import { AuthService } from '../../src/features/auth/auth.service';
import { PrismaService } from '../../src/prisma/prisma.service';
import { Public } from '../../src/shared/auth/session.guard';
import { ApiException } from '../../src/shared/errors/api-exception';
import { assertErrorContract } from '../support/contract-validator';

class NestedDto {
  @IsString()
  title!: string;
}
class ProbeDto {
  @ValidateNested()
  @Type(() => NestedDto)
  nested!: NestedDto;

  // Required nullable: only null bypasses the string validator, not undefined.
  @ValidateIf((_object: unknown, value: unknown) => value !== null)
  @IsString()
  label!: string | null;
}

/** Only registered in this test host; no probe endpoint is added to the runtime. */
@Public()
@Controller('foundation-probe')
class ProbeController {
  @Post()
  @HttpCode(200)
  post(@Body() body: ProbeDto) { return body; }

  @Get('domain-error')
  domainError() { throw ApiException.conflict('revision_conflict', 'ข้อมูลเปลี่ยนไปแล้ว'); }

  @Get('unhandled')
  unhandled() { throw new Error('password=DO_NOT_EXPOSE; provider_token=PRIVATE'); }

  @Get('http-error')
  httpError() { throw new InternalServerErrorException('PRIVATE_DATABASE_URL'); }
}

describe('FOUNDATION-01 HTTP boundary', () => {
  let app: INestApplication;
  const login = jest.fn();
  const prisma = { onModuleInit: jest.fn(), onModuleDestroy: jest.fn(), $executeRawUnsafe: jest.fn() };
  let errorLog: jest.SpyInstance;

  beforeAll(async () => {
    errorLog = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    const module = await Test.createTestingModule({ imports: [AppModule], controllers: [ProbeController] })
      .overrideProvider(PrismaService).useValue(prisma)
      .overrideProvider(AuthService).useValue({ login, getAuthMethods: jest.fn(), logout: jest.fn() })
      .compile();
    app = module.createNestApplication({ logger: false });
    configureApplication(app, ['http://localhost:3000']);
    await app.init();
  });
  afterAll(async () => { await app.close(); errorLog.mockRestore(); });
  beforeEach(() => login.mockClear());

  it('initializes the real module tree without seeds, migrations or provider calls', () => {
    expect(prisma.$executeRawUnsafe).not.toHaveBeenCalled();
    expect(login).not.toHaveBeenCalled();
    // The stub exposes no model writes: an accidental startup seed fails initialization.
    expect(prisma.onModuleInit).toHaveBeenCalledTimes(1);
  });

  it.each([
    { identifier: 'learner', password: 'demo', audience: 'web', roles: ['admin'] },
    { identifier: 'learner', password: 'demo', audience: 'other' },
    { identifier: 'learner', password: null, audience: 'web' },
    { identifier: 123, password: 'demo', audience: 'web' },
    { identifier: '', password: 'demo', audience: 'web' },
    { identifier: 'learner', audience: 'web' },
    [],
  ])('rejects invalid LoginRequest before calling auth (%j)', async payload => {
    const res = await request(app.getHttpServer()).post('/api/v1/auth/login').send(payload).expect(422);
    assertErrorContract(res.body);
    expect(res.body.error.code).toBe('validation_failed');
    expect(login).not.toHaveBeenCalled();
    expect(JSON.stringify(res.body)).not.toContain('demo');
  });

  it('accepts the exact valid login shape and preserves controller mapping', async () => {
    login.mockResolvedValueOnce({ secret: 'test-only-secret', expiresAt: new Date(Date.now() + 60000), user: { id: 'test-user' } });
    await request(app.getHttpServer()).post('/api/v1/auth/login').set('x-melearn-app', 'web')
      .send({ identifier: 'learner', password: 'test-only', audience: 'web' }).expect(200);
    expect(login).toHaveBeenCalledWith('learner', 'test-only', 'web', 'web');
  });

  it('normalizes malformed JSON as a safe canonical 400 error', async () => {
    const res = await request(app.getHttpServer()).post('/api/v1/auth/login')
      .set('Content-Type', 'application/json').send('{"password":"PRIVATE",').expect(400);
    assertErrorContract(res.body);
    expect(res.body.error.code).toBe('validation_failed');
    expect(JSON.stringify(res.body)).not.toContain('PRIVATE');
  });

  it('accepts a required nullable field and nested DTO', async () => {
    await request(app.getHttpServer()).post('/api/v1/foundation-probe')
      .send({ nested: { title: 'valid' }, label: null }).expect(200);
  });

  it.each([
    [{ nested: { title: 'valid' } }, 'label'],
    [{ nested: { title: 5 }, label: null }, 'nested.title'],
    [{ nested: { title: 'valid', private: 'hidden' }, label: null }, 'nested.private'],
  ])('reports safe nested/required field paths', async (body, field) => {
    const res = await request(app.getHttpServer()).post('/api/v1/foundation-probe').send(body).expect(422);
    assertErrorContract(res.body);
    expect(res.body.error.details.fields).toContainEqual({ field, code: 'invalid' });
  });

  it('preserves domain code and safe message', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/foundation-probe/domain-error').expect(409);
    assertErrorContract(res.body);
    expect(res.body.error.code).toBe('revision_conflict');
  });

  it.each(['unhandled', 'http-error'])('redacts internal %s exceptions from response and logs', async path => {
    const res = await request(app.getHttpServer()).get(`/api/v1/foundation-probe/${path}`).expect(500);
    assertErrorContract(res.body);
    expect(res.body.error.code).toBe('internal_error');
    expect(JSON.stringify(res.body)).not.toMatch(/PRIVATE|DO_NOT_EXPOSE/);
    expect(JSON.stringify(errorLog.mock.calls)).not.toMatch(/PRIVATE|DO_NOT_EXPOSE/);
  });

  it('does not trust incoming correlation IDs and returns unique matching body/header IDs', async () => {
    const first = await request(app.getHttpServer()).get('/api/v1/missing').set('x-request-id', 'untrusted-secret').expect(404);
    const second = await request(app.getHttpServer()).get('/api/v1/missing').expect(404);
    assertErrorContract(first.body);
    expect(first.body.error.request_id).toBe(first.headers['x-request-id']);
    expect(first.body.error.request_id).not.toBe('untrusted-secret');
    expect(first.body.error.request_id).not.toBe(second.body.error.request_id);
  });

  it('only allows the configured browser origin', async () => {
    const allowed = await request(app.getHttpServer()).options('/api/v1/auth/login').set('Origin', 'http://localhost:3000').expect(204);
    expect(allowed.headers['access-control-allow-origin']).toBe('http://localhost:3000');
    const other = await request(app.getHttpServer()).options('/api/v1/auth/login').set('Origin', 'https://unknown.example').expect(204);
    expect(other.headers['access-control-allow-origin']).toBeUndefined();
  });
});
