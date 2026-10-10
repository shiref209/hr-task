import type { IncomingMessage, ServerResponse } from 'node:http';

// Defence in depth: the serializers below already keep headers out of every log line.
export const redact = {
  paths: [
    'req.headers.cookie',
    'req.headers.authorization',
    'res.headers["set-cookie"]',
  ],
  remove: true,
};

// Only method, path and status are ever logged: no headers, body or query string (search terms can be names).
export const serializers = {
  req: (req: Pick<IncomingMessage, 'method' | 'url'>) => ({
    method: req.method,
    path: (req.url ?? '').split('?')[0],
  }),
  res: (res: Pick<ServerResponse, 'statusCode'>) => ({
    status: res.statusCode,
  }),
};
