import { Module } from '@nestjs/common';
import { DepartmentsController } from './departments.controller';
import { DEPARTMENT_REPOSITORY } from './departments.repository';
import { DepartmentsService } from './departments.service';
import { PrismaDepartmentsRepository } from './prisma-departments.repository';

@Module({
  controllers: [DepartmentsController],
  providers: [
    DepartmentsService,
    { provide: DEPARTMENT_REPOSITORY, useClass: PrismaDepartmentsRepository },
  ],
  exports: [DEPARTMENT_REPOSITORY],
})
export class DepartmentsModule {}
