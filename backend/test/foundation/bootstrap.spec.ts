import { INestApplication, Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { bootstrap } from '../../src/main';
import * as environment from '../../src/shared/config/environment';
import * as seed from '../fixtures/prototype-fixtures';

describe('FOUNDATION-01 runtime bootstrap', () => {
  afterEach(() => jest.restoreAllMocks());

  it('uses the shared HTTP bootstrap and never seeds or migrates', async () => {
    const app = {
      use: jest.fn(), useBodyParser: jest.fn(), setGlobalPrefix: jest.fn(), enableCors: jest.fn(),
      useGlobalPipes: jest.fn(), useGlobalFilters: jest.fn(), enableShutdownHooks: jest.fn(),
      listen: jest.fn().mockResolvedValue(undefined), close: jest.fn().mockResolvedValue(undefined),
    };
    const create = jest.spyOn(NestFactory, 'create').mockResolvedValue(app as unknown as INestApplication);
    const load = jest.spyOn(environment, 'loadLocalEnvironment').mockImplementation(() => undefined);
    jest.spyOn(environment, 'httpConfiguration').mockReturnValue({ port: 4000, origins: ['http://localhost:3000'] });
    jest.spyOn(Logger, 'log').mockImplementation(() => undefined);
    const seedCall = jest.spyOn(seed, 'seedInitialData');
    await bootstrap();
    expect(load).toHaveBeenCalledTimes(1);
    expect(create).toHaveBeenCalledTimes(1);
    expect(app.setGlobalPrefix).toHaveBeenCalledWith('api/v1');
    expect(app.useGlobalPipes).toHaveBeenCalledTimes(1);
    expect(app.useGlobalFilters).toHaveBeenCalledTimes(1);
    expect(app.useBodyParser).toHaveBeenCalledWith('raw', expect.objectContaining({ inflate: false, limit: '100kb' }));
    expect(app.listen).toHaveBeenCalledWith(4000);
    expect(seedCall).not.toHaveBeenCalled();
  });
});
