import { Module } from '@nestjs/common';
import { EmployeesModule } from '../../employees/employees.module';
import { PayItemsController } from './pay-items.controller';
import { PrismaPayItemsRepository } from './prisma-pay-items.repository';
import { PAY_ITEM_REPOSITORY } from './pay-items.repository';
import { PayItemsService } from './pay-items.service';

@Module({
  imports: [EmployeesModule],
  controllers: [PayItemsController],
  providers: [
    PayItemsService,
    { provide: PAY_ITEM_REPOSITORY, useClass: PrismaPayItemsRepository },
  ],
  exports: [PAY_ITEM_REPOSITORY],
})
export class PayItemsModule {}
