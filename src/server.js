const env = require('./config/env');
const app = require('./app');

const server = app.listen(env.PORT, '0.0.0.0', () => {
  console.log(`Field Reports server listening on :${env.PORT} (${env.NODE_ENV})`);
});

// Node's default 5-minute request timeout would kill a slow 2G upload mid-body. Disable it;
// the client enforces its own timeouts.
server.requestTimeout = 0;
server.headersTimeout = 65_000;
server.keepAliveTimeout = 65_000;

function shutdown(signal) {
  console.log(`${signal} received, closing server`);
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 10_000).unref();
}
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
