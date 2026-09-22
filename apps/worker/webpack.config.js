const { composePlugins, withNx } = require('@nx/webpack');

// See apps/api/webpack.config.js for why this override exists: libs/uptime-db
// and libs/queue are plain, unbuilt TS source consumed via tsconfig path
// aliases, so they must be bundled (not left as externals) for a Nest app's
// compiled output to actually resolve them at runtime.
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
