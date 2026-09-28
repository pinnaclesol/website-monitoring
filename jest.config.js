/**
 * Single root Jest config for unit tests across the monorepo (mirrors the
 * one-root-.env convention elsewhere in this repo — one config, not a
 * per-app/lib jest.config). Resolves the same `@uptime/<lib>` path aliases
 * as tsconfig.base.json so service files under test can import
 * `@uptime/auth`/`@uptime/uptime-db` exactly as they do at runtime.
 */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/apps/api/src', '<rootDir>/libs/auth/src'],
  testMatch: ['**/*.spec.ts'],
  moduleNameMapper: {
    '^@uptime/auth$': '<rootDir>/libs/auth/src/index.ts',
    '^@uptime/uptime-db$': '<rootDir>/jest.mocks/uptime-db.js',
    '^@uptime/queue$': '<rootDir>/libs/queue/src/index.ts',
    // NestJS 12 ships ESM-only with an `import.meta.url` internal that
    // can't be mechanically transpiled to CommonJS — see
    // jest.mocks/nestjs-common.js's header for the full explanation.
    '^@nestjs/common$': '<rootDir>/jest.mocks/nestjs-common.js',
    '^@nestjs/core$': '<rootDir>/jest.mocks/nestjs-core.js',
  },
  transform: {
    // Overrides tsconfig.base.json's `module: "ESNext"` to CommonJS — Jest
    // runs under Node's CJS loader, and ts-jest otherwise emits ESM output
    // Node can't `require()`.
    '^.+\\.ts$': ['ts-jest', { tsconfig: { ...require('./tsconfig.base.json').compilerOptions, module: 'commonjs' } }],
  },
};
