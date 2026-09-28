/**
 * Minimal CJS stand-in for `@nestjs/core`, used only in Jest unit tests —
 * see nestjs-common.js's file header for why the real (ESM-only) package
 * can't be required under Jest's CJS runtime. `PermissionGuard`'s tests
 * construct their own fake `Reflector` object directly, so this class is
 * never actually instantiated — it only needs to exist so the guard's
 * `import { Reflector } from '@nestjs/core'` (used purely as a constructor
 * parameter type) resolves to something.
 */
class Reflector {
  getAllAndOverride() {
    return undefined;
  }
}

module.exports = { Reflector };
