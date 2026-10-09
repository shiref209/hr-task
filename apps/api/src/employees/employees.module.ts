import { Module } from '@nestjs/common';
import { CLOCK, SystemClock } from '../common/clock';
import { appConfig } from '../common/config';
import { DepartmentsModule } from '../departments/departments.module';
import { CreateEmployeePipe, UpdateEmployeePipe } from './employee-input.pipes';
import { EmployeesController } from './employees.controller';
import { EMPLOYEE_REPOSITORY } from './employees.repository';
import { EmployeesService } from './employees.service';
import { PrismaEmployeesRepository } from './prisma-employees.repository';
import { FILE_STORAGE } from './profile-image/file-storage';
import { LocalFileStorage } from './profile-image/local-file-storage';

@Module({
  imports: [DepartmentsModule],
  controllers: [EmployeesController],
  providers: [
    EmployeesService,
    CreateEmployeePipe,
    UpdateEmployeePipe,
    { provide: CLOCK, useClass: SystemClock },
    { provide: EMPLOYEE_REPOSITORY, useClass: PrismaEmployeesRepository },
    {
      provide: FILE_STORAGE,
      useFactory: () => new LocalFileStorage(appConfig.UPLOADS_DIR),
    },
  ],
})
export class EmployeesModule {}
