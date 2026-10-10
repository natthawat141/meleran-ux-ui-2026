import { INestApplication, PayloadTooLargeException, UnsupportedMediaTypeException, ValidationPipe } from '@nestjs/common';
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
  app.use('/api/v1/webhooks/stripe', (error: unknown, _request: Request, _response: Response, next: NextFunction) => {
    // Body-parser errors are not Nest HttpExceptions. Translate only its known
    // limit/encoding cases; never pass raw body/error.message into the response.
    const parserError = error as { status?: number; type?: string } | null;
    if (parserError?.status === 413 && parserError.type === 'entity.too.large') next(new PayloadTooLargeException());
    else if (parserError?.status === 415 && parserError.type === 'encoding.unsupported') next(new UnsupportedMediaTypeException());
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
