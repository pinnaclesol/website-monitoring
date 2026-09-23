import path from 'path';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import { PrismaClient } from './generated';

// This workspace uses ONE root .env for every app and lib (not a per-app/lib
// .env) — see CLAUDE.md's Environment Setup section. Load it explicitly
// rather than relying on the caller's cwd — this script can be invoked via
// `npm run --prefix libs/uptime-db seed` from the repo root, or directly
// from within libs/uptime-db, and must behave the same either way.
// __dirname is libs/uptime-db/src, so three levels up is the repo root.
dotenv.config({ path: path.resolve(__dirname, '..', '..', '..', '.env') });

const BCRYPT_SALT_ROUNDS = 10;

async function main() {
  const username = process.env.ADMIN_USERNAME;
  const password = process.env.ADMIN_PASSWORD;
  // Optional — falls back to "Super Admin" if unset, matching the display
  // name shown for this account everywhere else (sidebar, Users list).
  const name = process.env.ADMIN_NAME || 'Super Admin';

  if (!username || !password) {
    throw new Error(
      '[Uptime-DB] Seed failed: ADMIN_USERNAME and ADMIN_PASSWORD must both be set in the repo root .env before seeding the admin user.',
    );
  }

  const prisma = new PrismaClient();

  try {
    const hashedPassword = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);

    const user = await prisma.user.upsert({
      where: { username },
      update: { password: hashedPassword, active: true, role: 'ADMIN', isProtected: true, name },
      create: { username, password: hashedPassword, active: true, role: 'ADMIN', isProtected: true, name },
    });

    console.log(`[Uptime-DB] Admin user "${user.username}" is ready.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
