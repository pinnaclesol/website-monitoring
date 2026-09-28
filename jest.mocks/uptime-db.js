/**
 * Minimal CJS stand-in for `@uptime/uptime-db`, used only in Jest unit
 * tests (see jest.config.js's moduleNameMapper). The real module re-exports
 * a Prisma-generated client plus a `@Global()`/`@Module()`-decorated Nest
 * module (`prisma.module.ts`), which would drag the real `@nestjs/common`
 * back in — see jest.mocks/nestjs-common.js's header for why that can't be
 * `require()`d under Jest.
 *
 * Every service/guard under unit test here takes `UptimePrismaService` only
 * as a constructor parameter type (with `emitDecoratorMetadata` on, the
 * class must exist at runtime for TS's emitted `design:paramtypes`, even
 * though nothing here actually instantiates it — every test passes its own
 * hand-built `prisma` mock object typed `as never` instead).
 */
class UptimePrismaService {}

module.exports = { UptimePrismaService };
