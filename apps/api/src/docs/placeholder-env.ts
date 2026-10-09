// The export only describes routes, so it must run without real secrets; `appConfig` still requires one.
process.env.JWT_ACCESS_SECRET ??= 'docs-export-placeholder-not-a-secret-000000';
