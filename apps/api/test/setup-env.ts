// Jest setupFiles entry (unit + e2e). Must run before any module that parses
// `appConfig`, which requires JWT_ACCESS_SECRET (>= 32 chars).
process.env.JWT_ACCESS_SECRET ??=
  'test-only-access-secret-0123456789abcdef-not-a-real-secret';
