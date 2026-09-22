//@ts-check

const path = require('path');

// This workspace uses ONE root .env for every app (not a per-app .env) — see
// CLAUDE.md's Environment Setup section. Next.js only auto-loads .env files
// from its own app directory (apps/web/.env*), so load the root one
// explicitly, before anything else runs, so NEXT_PUBLIC_* vars get inlined
// correctly at build time and server code sees the rest via process.env.
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const { composePlugins, withNx } = require('@nx/next');

/**
 * @type {import('@nx/next/plugins/with-nx').WithNxOptions}
 **/
const nextConfig = {
  nx: {
    svgr: false,
  },
};

const plugins = [
  // Add more Next.js plugins to this list if needed.
  withNx,
];

module.exports = composePlugins(...plugins)(nextConfig);
