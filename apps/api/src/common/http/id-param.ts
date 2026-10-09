import { Param } from '@nestjs/common';
import { idParamSchema } from '@hr/types';
import { ZodValidationPipe } from './zod-validation.pipe';

export const ValidIdParam = () => Param(new ZodValidationPipe(idParamSchema));
