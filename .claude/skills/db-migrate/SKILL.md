---
name: db-migrate
description: Add or modify a Prisma model in libs/uptime-db and run a migration. Usage: /db-migrate <migration-name>
allowed-tools: Bash, Read, Write, Glob, Grep
user-invocable: true
---

Add or modify a Prisma model in **`libs/uptime-db/prisma/schema.prisma`** and migrate the dedicated Postgres DB.

Migration name: `$ARGUMENTS`

## Rules

- All Prisma work targets `libs/uptime-db/prisma/schema.prisma`.
- `DATABASE_URL` is read from `libs/uptime-db/.env` — not from `apps/api/.env` or `apps/worker/.env`.
- Never create a `prisma/` folder inside `apps/api` or `apps/worker` — neither has its own Prisma.
- Never run `prisma migrate reset` — it wipes all data.
- Warn the user before any migration that drops columns or tables.
- Plain PascalCase model/table names — no prefix needed (this DB is fully dedicated to this app).

## Steps

### 1. Show current schema
```bash
cat libs/uptime-db/prisma/schema.prisma
```

### 2. Verify DATABASE_URL is set
```bash
grep DATABASE_URL libs/uptime-db/.env
```
If missing, tell the user to add `DATABASE_URL=postgresql://...` pointing to the dedicated uptime-monitor DB.

### 3. Add or update the model
```prisma
model Foo {
  id        String   @id @default(cuid())
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  // ... fields ...
}
```

### 4. Generate the Prisma client
```bash
npm run uptime:generate
```

### 5. Apply the migration
```bash
npm run uptime:migrate -- --name "$ARGUMENTS"
```
If `$ARGUMENTS` is empty, remind the user: `/db-migrate <migration-name>`

### 6. Confirm
Show the new migration file in `libs/uptime-db/prisma/migrations/` and confirm success. If the new/changed model is one `apps/api` or `apps/worker` will query, remind the user to run `/new-api-resource` or update the relevant service.
