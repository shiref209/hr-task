import { INestApplication } from '@nestjs/common';
import { jsonParseErrorMiddleware } from './common/http/json-parse-error.middleware';
import { ErrorDetailsFilter } from './common/http/error-details.filter';
import { ResponseEnvelopeInterceptor } from './common/http/response-envelope.interceptor';

export function configureApp(app: INestApplication): void {
  // Nest registers the body parser at init(), after this runs: register it now so the error middleware sits behind it
  // and sees the raw parse error before Nest's error handler rewrites it. init() skips parsers already applied.
  app.getHttpAdapter().registerParserMiddleware('', false);
  app.use(jsonParseErrorMiddleware);
  app.useGlobalFilters(new ErrorDetailsFilter());
  app.useGlobalInterceptors(new ResponseEnvelopeInterceptor());
}
