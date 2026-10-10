import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { configureApplication } from './bootstrap';
import { httpConfiguration, loadLocalEnvironment } from './shared/config/environment';

export async function bootstrap(): Promise<void> {
  loadLocalEnvironment();
  const config = httpConfiguration();
  const app = await NestFactory.create(AppModule, { abortOnError: false });
  configureApplication(app, config.origins);
  app.enableShutdownHooks();
  // Migrations and fixtures are explicit operator/test actions, never startup work.
  try {
    await app.listen(config.port);
  } catch (error: unknown) {
    await app.close();
    throw error;
  }
  Logger.log(`API listening on port ${config.port} with prefix /api/v1`, 'Bootstrap');
}

if (require.main === module) {
  void bootstrap().catch(() => {
    Logger.error('API startup failed; check local configuration and database readiness.', 'Bootstrap');
    process.exitCode = 1;
  });
}
