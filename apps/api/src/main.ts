import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { appConfig } from './common/config';
import { configureApp } from './configure-app';
import { setupSwagger } from './docs/openapi';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.enableCors({ origin: process.env.WEB_ORIGIN ?? 'http://localhost:5173' });
  configureApp(app);
  setupSwagger(app, { enabled: appConfig.SWAGGER_ENABLED });
  app.useStaticAssets(appConfig.UPLOADS_DIR, { prefix: '/uploads' });
  await app.listen(process.env.API_PORT ?? 3000);
}
void bootstrap();
