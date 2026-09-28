/**
 * Minimal CJS stand-in for `@nestjs/common`, used only in Jest unit tests
 * (see jest.config.js's moduleNameMapper).
 *
 * NestJS 12 ships ESM-only (`"type": "module"`, no CJS build), and one of
 * its own internals (`utils/load-package.util.js`) uses `import.meta.url`
 * — a construct TypeScript cannot mechanically rewrite to CommonJS, so
 * there is no way to `require()` the real package under Jest's default CJS
 * runtime. The unit tests here never boot a real Nest application (no
 * `TestingModule`/DI container — services are instantiated directly with a
 * mocked Prisma client), so all they actually need from this package is:
 * exception classes with the right name/message/status, and no-op
 * decorators. Real behavior (HTTP status mapping, exception filters,
 * `@RequirePermission`/`@Public` wiring) is covered by the live API
 * verification pass instead, against the real framework.
 */
class HttpExceptionBase extends Error {
  constructor(message, status) {
    super(typeof message === 'string' ? message : JSON.stringify(message));
    this.name = this.constructor.name;
    this.status = status;
  }
  getStatus() {
    return this.status;
  }
}

class BadRequestException extends HttpExceptionBase {
  constructor(message) {
    super(message, 400);
  }
}
class UnauthorizedException extends HttpExceptionBase {
  constructor(message) {
    super(message, 401);
  }
}
class ForbiddenException extends HttpExceptionBase {
  constructor(message) {
    super(message, 403);
  }
}
class NotFoundException extends HttpExceptionBase {
  constructor(message) {
    super(message, 404);
  }
}
class ConflictException extends HttpExceptionBase {
  constructor(message) {
    super(message, 409);
  }
}

function Injectable() {
  return function (target) {
    return target;
  };
}

// Decorator factory — the unit tests here never read metadata back off a
// route handler (that's PermissionGuard's job against a real Reflector,
// exercised live instead), so this only needs to be a harmless no-op.
function SetMetadata() {
  return function (target, propertyKey, descriptor) {
    return descriptor || target;
  };
}

module.exports = {
  Injectable,
  SetMetadata,
  BadRequestException,
  UnauthorizedException,
  ForbiddenException,
  NotFoundException,
  ConflictException,
};
