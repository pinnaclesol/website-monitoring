"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UptimePrismaService = void 0;
const tslib_1 = require("tslib");
const common_1 = require("@nestjs/common");
const generated_1 = require("./generated");
let UptimePrismaService = class UptimePrismaService extends generated_1.PrismaClient {
    async onModuleInit() { await this.$connect(); }
    async onModuleDestroy() { await this.$disconnect(); }
};
exports.UptimePrismaService = UptimePrismaService;
exports.UptimePrismaService = UptimePrismaService = tslib_1.__decorate([
    (0, common_1.Injectable)()
], UptimePrismaService);
//# sourceMappingURL=prisma.service.js.map