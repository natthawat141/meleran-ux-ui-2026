import { INestApplication, ValidationPipe } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import * as cookieParser from 'cookie-parser';
import { Request, Response, NextFunction } from 'express';
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
