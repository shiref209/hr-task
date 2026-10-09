import { applyDecorators } from '@nestjs/common';
import {
  ApiBody,
  ApiParam,
  ApiQuery,
  ApiResponse,
  type SchemaObject,
} from '@nestjs/swagger';
import { STATUS_CODES } from 'node:http';
import { z } from 'zod';
import { idParamSchema, paginationMetaSchema } from '@hr/types';

export const PROBLEM_DETAILS = 'ProblemDetails';
const PROBLEM_JSON = 'application/problem+json';

export function toOpenApiSchema(
  schema: z.ZodType,
  io: 'input' | 'output',
): SchemaObject {
  const json = z.toJSONSchema(schema, { io, target: 'openapi-3.0' });
  delete json.$schema;
  return json as SchemaObject;
}

export const apiBody = (schema: z.ZodType) =>
  ApiBody({ schema: toOpenApiSchema(schema, 'input') });

export const apiIdParam = () =>
  ApiParam({
    name: 'id',
    schema: toOpenApiSchema(idParamSchema.shape.id, 'input'),
  });

export function apiQuery(schema: z.ZodObject) {
  const { properties = {}, required = [] } = toOpenApiSchema(schema, 'input');
  return applyDecorators(
    ...Object.entries(properties).map(([name, property]) =>
      ApiQuery({
        name,
        required: required.includes(name),
        schema: property as SchemaObject,
      }),
    ),
  );
}

export function apiEnvelope(
  schema: z.ZodType,
  { status = 200, paginated = false } = {},
) {
  const envelope = paginated
    ? z.object({ data: z.array(schema), meta: paginationMetaSchema })
    : z.object({ data: schema });
  return ApiResponse({
    status,
    description: STATUS_CODES[status],
    content: {
      'application/json': { schema: toOpenApiSchema(envelope, 'output') },
    },
  });
}

export const apiProblems = (...statuses: number[]) =>
  applyDecorators(
    ...statuses.map((status) =>
      ApiResponse({
        status,
        description: STATUS_CODES[status],
        content: {
          [PROBLEM_JSON]: {
            schema: { $ref: `#/components/schemas/${PROBLEM_DETAILS}` },
          },
        },
      }),
    ),
  );
