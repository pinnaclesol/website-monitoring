---
name: new-api-resource
description: Scaffold a new NestJS module/controller/service/DTO in apps/api, plus the matching Next.js proxy route in apps/web. Usage: /new-api-resource <resource-name>
allowed-tools: Read, Write, Glob, Grep
user-invocable: true
---

Scaffold a new NestJS resource (module + controller + service + DTO) in **`apps/api/src/`**, plus a matching proxy route in **`apps/web/app/api/`**.

Argument: `$ARGUMENTS` — resource name in kebab-case (e.g. `monitors`, `incidents`, `telegram-accounts`)

## Architecture reminder

- Prisma lives in `libs/uptime-db/` — import `UptimePrismaService` from `@uptime/uptime-db`, never instantiate a client directly.
- `apps/api` is a BullMQ **producer only** — if this resource needs to trigger worker activity (e.g. registering a repeatable check job), import the `Queue` client from `@uptime/queue`. Never import a BullMQ `Worker` here.
- Every route needs a DTO + `ValidationPipe`.
- All routes except `/api/auth/validate` require the internal API key header — the guard is already wired globally.

## Steps

### 1. Resolve names
From `$ARGUMENTS` derive: directory `apps/api/src/<resource>/`, `<PascalCase>Module`/`Controller`/`Service`, Prisma accessor (check `libs/uptime-db/prisma/schema.prisma` for the matching model — if it doesn't exist yet, tell the user to run `/db-migrate` first), route prefix `api/<resource>`.

### 2. Create the DTO(s)
`apps/api/src/<resource>/dto/create-<resource>.dto.ts` (and `update-<resource>.dto.ts` if needed) using `class-validator` decorators matching the Prisma model's fields.

### 3. Create the service
`apps/api/src/<resource>/<resource>.service.ts`:
```ts
import { Injectable } from '@nestjs/common';
import { UptimePrismaService } from '@uptime/uptime-db';

@Injectable()
export class <PascalCase>Service {
  constructor(private prisma: UptimePrismaService) {}

  findAll() {
    return this.prisma.<prismaAccessor>.findMany({ orderBy: { createdAt: 'desc' } });
  }
  findOne(id: string) {
    return this.prisma.<prismaAccessor>.findUnique({ where: { id } });
  }
  create(data: Create<PascalCase>Dto) {
    return this.prisma.<prismaAccessor>.create({ data });
  }
  update(id: string, data: Update<PascalCase>Dto) {
    return this.prisma.<prismaAccessor>.update({ where: { id }, data });
  }
  remove(id: string) {
    return this.prisma.<prismaAccessor>.update({ where: { id }, data: { deletedAt: new Date() } }); // soft delete if the model has deletedAt
  }
}
```

### 4. Create the controller
`apps/api/src/<resource>/<resource>.controller.ts` — standard REST verbs, DTOs on `@Body()`, no `@Permission()` decorators (this app has no RBAC).

### 5. Create the module
`apps/api/src/<resource>/<resource>.module.ts`, register in `apps/api/src/app.module.ts`.

### 6. Create the Next.js proxy route
`apps/web/app/api/<resource>/route.ts`:
```ts
import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "../../../lib/auth"

const API_URL = process.env.API_URL ?? "http://localhost:4001"

async function authedHeaders() {
  const session = await getServerSession(authOptions)
  if (!session) throw new Error("unauthenticated")
  return { "Content-Type": "application/json", "x-internal-api-key": process.env.INTERNAL_API_KEY! }
}

export async function GET() {
  const res = await fetch(`${API_URL}/api/<resource>`, { headers: await authedHeaders() })
  return NextResponse.json(await res.json(), { status: res.status })
}

export async function POST(req: NextRequest) {
  const res = await fetch(`${API_URL}/api/<resource>`, {
    method: "POST",
    headers: await authedHeaders(),
    body: JSON.stringify(await req.json()),
  })
  return NextResponse.json(await res.json(), { status: res.status })
}
```

### 7. Confirm
List all files created and the AppModule change.
