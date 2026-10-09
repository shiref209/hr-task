import { INestApplication } from '@nestjs/common';
import {
  DocumentBuilder,
  SwaggerModule,
  type OpenAPIObject,
} from '@nestjs/swagger';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { errorDetailsSchema } from '@hr/types';
import { PROBLEM_DETAILS, toOpenApiSchema } from './zod-openapi';

const { version } = JSON.parse(
  readFileSync(join(__dirname, '../../package.json'), 'utf8'),
) as { version: string };

export function buildOpenApiDocument(app: INestApplication): OpenAPIObject {
  const document = SwaggerModule.createDocument(
    app,
    new DocumentBuilder()
      .setTitle('HR Payroll API')
      .setVersion(version)
      .addCookieAuth('access_token')
      .build(),
  );
  document.components = {
    ...document.components,
    schemas: {
      ...document.components?.schemas,
      [PROBLEM_DETAILS]: toOpenApiSchema(errorDetailsSchema, 'output'),
    },
  };
  return document;
}

export function setupSwagger(
  app: INestApplication,
  { enabled }: { enabled: boolean },
): void {
  if (!enabled) return;
  SwaggerModule.setup('docs', app, buildOpenApiDocument(app), {
    jsonDocumentUrl: 'docs-json',
  });
}
