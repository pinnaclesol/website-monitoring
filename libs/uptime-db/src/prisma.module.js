"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UptimePrismaModule = void 0;
const tslib_1 = require("tslib");
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("./prisma.service");
let UptimePrismaModule = class UptimePrismaModule {
};
exports.UptimePrismaModule = UptimePrismaModule;
exports.UptimePrismaModule = UptimePrismaModule = tslib_1.__decorate([
    (0, common_1.Global)(),
    (0, common_1.Module)({
        providers: [prisma_service_1.UptimePrismaService],
        exports: [prisma_service_1.UptimePrismaService],
    })
], UptimePrismaModule);
//# sourceMappingURL=prisma.module.js.map