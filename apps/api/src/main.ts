import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { appConfig } from './common/config';
import { configureApp } from './configure-app';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  configureApp(app);
  app.useStaticAssets(appConfig.UPLOADS_DIR, { prefix: '/uploads' });
  await app.listen(process.env.API_PORT ?? 3000);
}
void bootstrap();
