const { spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');

// This workspace uses ONE root .env for every app and lib (not a per-app/lib
// .env) — see CLAUDE.md's Environment Setup section. In production, secrets
// can instead be injected straight into process.env (e.g. via Doppler), so
// no physical .env file needs to exist there.
const envPath = path.resolve(__dirname, '../../.env');

if (fs.existsSync(envPath)) {
  const dotenv = require('dotenv');
  dotenv.config({ path: envPath, override: true });
  console.log(`[Uptime-DB] Loaded database environment from: ${envPath}`);
} else if (process.env.DATABASE_URL) {
  console.log('[Uptime-DB] No .env file found; using environment variables already present (e.g. from Doppler).');
} else {
  console.error(
    `[Uptime-DB] Error: No .env file found at ${envPath} and DATABASE_URL is not set in the environment.`,
  );
  process.exit(1);
}

const args = process.argv.slice(2);
const isWin = process.platform === 'win32';
const cmd = isWin ? 'npx.cmd' : 'npx';

const result = spawnSync(cmd, ['prisma', ...args], {
  stdio: 'inherit',
  env: process.env,
  shell: true
});

process.exit(result.status ?? 0);
