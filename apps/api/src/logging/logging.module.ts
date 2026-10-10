import { Module } from '@nestjs/common';
import { LoggerModule } from 'nestjs-pino';
import { appConfig } from '../common/config';
import { buildPinoHttpOptions } from './logger-options';

@Module({
  imports: [
    LoggerModule.forRoot({ pinoHttp: buildPinoHttpOptions(appConfig) }),
  ],
})
export class LoggingModule {}
