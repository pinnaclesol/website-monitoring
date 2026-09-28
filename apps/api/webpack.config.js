const { composePlugins, withNx } = require('@nx/webpack');

// libs/uptime-db, libs/queue, and libs/auth are plain, unbuilt TS source
// (no dist/ output, package.json "main" points straight at src/index.ts) —
// consumed directly by Next.js's bundler and by tsx-run scripts, but a
// Nest app compiled by plain `tsc`/`nest build` would leave
// `require('@uptime/uptime-db')` unresolved at runtime (Node can't load a
// .ts file). Force webpack to bundle these workspace packages (instead of
// treating them as externals, its default for anything in node_modules)
// so their TS source gets resolved (via tsconfig paths) and transpiled
// straight into this app's output bundle. Same fix the sibling
// billing-manager repo uses in apps/billing-api/webpack.config.js for the
// identical problem with @billing/rebil-db.
module.exports = composePlugins(withNx(), (config) => {
  if (config.externals && Array.isArray(config.externals)) {
    config.externals = config.externals.map((external) => {
      if (typeof external === 'function') {
        return (context, callback) => {
          const request = context.request;
          if (request && request.startsWith('@uptime/')) {
            return callback();
          }
          return external(context, callback);
        };
      }
      return external;
    });
  }

  return config;
});
