import { BadRequestException, INestApplication, PayloadTooLargeException, UnsupportedMediaTypeException, ValidationPipe } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import * as cookieParser from 'cookie-parser';
import type { Request, Response, NextFunction } from 'express';
import type { IncomingMessage } from 'node:http';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { ApiExceptionFilter } from './shared/errors/api-exception.filter';
import { validationException } from './shared/errors/validation-exception';

/** Shared by runtime and HTTP test hosts; no persistence/provider side effects. */
export function configureApplication(app: INestApplication, origins: string[]): void {
  app.use((_request: Request, response: Response, next: NextFunction) => {
    response.locals.requestId = randomUUID();
    response.setHeader('x-request-id', response.locals.requestId as string);
    next();
  });
  app.use(cookieParser());
  // Register before Nest's JSON parser: signatures cover the original bytes.
  // No inflation, JSON decoding or browser DTO validation on this provider route.
  (app as NestExpressApplication).useBodyParser('raw', {
    type: (request: IncomingMessage) => request.method === 'POST' &&
      /^\/api\/v1\/webhooks\/stripe\/?$/i.test((request.url || '').split('?')[0]) &&
      request.headers['content-type']?.split(';')[0].trim().toLowerCase() === 'application/json',
    limit: '100kb', inflate: false,
  });
  // Canonical TranscriptRequest permits 200,000 Unicode characters: fully escaped
  // astral Unicode can require 2.4MB. Only that PUT gets 3MiB; other JSON and
  // Stripe raw retain 100KiB. Explicitly register both JSON parser branches.
  const jsonRequest = (request: IncomingMessage) =>
    request.headers['content-type']?.split(';')[0].trim().toLowerCase() === 'application/json';
  const transcriptRequest = (request: IncomingMessage) => request.method === 'PUT' &&
    /^\/api\/v1\/admin\/courses\/[^/]+\/videos\/[^/]+\/ai-transcript\/?$/i.test((request.url || '').split('?')[0]);
  const largeWriteRequest = (request: IncomingMessage) =>
    (request.method === 'POST' && /^\/api\/v1\/admin\/blog\/?$/i.test((request.url || '').split('?')[0])) ||
    (request.method === 'PATCH' && /^\/api\/v1\/admin\/blog\/[^/]+\/?$/i.test((request.url || '').split('?')[0])) ||
    (request.method === 'PATCH' && /^\/api\/v1\/courses\/[^/]+\/?$/i.test((request.url || '').split('?')[0])) ||
    (request.method === 'POST' && /^\/api\/v1\/(?:instructor|admin)\/courses\/?$/i.test((request.url || '').split('?')[0])) ||
    (request.method === 'PUT' && /^\/api\/v1\/learn\/attempts\/[^/]+\/answers\/?$/i.test((request.url || '').split('?')[0]));
  (app as NestExpressApplication).useBodyParser('json', { limit: '100kb',
    type: (request: IncomingMessage) => jsonRequest(request) && !transcriptRequest(request) && !largeWriteRequest(request) });
  (app as NestExpressApplication).useBodyParser('json', { limit: '3mb',
    type: (request: IncomingMessage) => jsonRequest(request) && transcriptRequest(request) });
  (app as NestExpressApplication).useBodyParser('json', { limit: '12mb',
    type: (request: IncomingMessage) => jsonRequest(request) && largeWriteRequest(request) });
  app.use((error: unknown, _request: Request, _response: Response, next: NextFunction) => {
    // Body-parser errors are not Nest HttpExceptions. Translate only its known
    // limit/encoding cases; never pass raw body/error.message into the response.
    const parserError = error as { status?: number; type?: string } | null;
    if (parserError?.status === 413 && parserError.type === 'entity.too.large') next(new PayloadTooLargeException());
    else if (parserError?.status === 415 && parserError.type === 'encoding.unsupported') next(new UnsupportedMediaTypeException());
    else if (parserError?.status === 400 && parserError.type === 'entity.parse.failed') next(new BadRequestException());
    else next(error);
  });
  app.setGlobalPrefix('api/v1');
  app.enableCors({ origin: origins, credentials: true });
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    forbidUnknownValues: true,
    transform: false,
    validationError: { target: false, value: false },
    exceptionFactory: validationException,
  }));
  app.useGlobalFilters(new ApiExceptionFilter());
}
