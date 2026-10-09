import { Inject, Injectable } from '@nestjs/common';
import {
  buildCreateEmployeeSchema,
  buildUpdateEmployeeSchema,
} from '@hr/types';
import { CLOCK, type Clock } from '../common/clock';
import { ZodValidationPipe } from '../common/http/zod-validation.pipe';

// The schemas need "today" for the hire-date rule, so they are built per request.
@Injectable()
export class CreateEmployeePipe extends ZodValidationPipe<
  ReturnType<typeof buildCreateEmployeeSchema>
> {
  constructor(@Inject(CLOCK) clock: Clock) {
    super(() => buildCreateEmployeeSchema({ today: clock.today() }));
  }
}

@Injectable()
export class UpdateEmployeePipe extends ZodValidationPipe<
  ReturnType<typeof buildUpdateEmployeeSchema>
> {
  constructor(@Inject(CLOCK) clock: Clock) {
    super(() => buildUpdateEmployeeSchema({ today: clock.today() }));
  }
}
