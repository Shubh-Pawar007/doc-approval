import { createApp } from './app';
import { createInMemoryDependencies, seedDemoData } from './bootstrap';
import { config } from './config';

async function main() {
  const deps = createInMemoryDependencies();
  if (config.seedDemoData) await seedDemoData(deps);

  const app = createApp(deps);
  const server = app.listen(config.port, () => {
    console.log(JSON.stringify({ level: 'info', message: `API listening on http://localhost:${config.port}` }));
  });

  // Graceful shutdown: stop accepting connections, let in-flight requests finish.
  const shutdown = (signal: string) => {
    console.log(JSON.stringify({ level: 'info', message: `${signal} received, shutting down` }));
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 10_000).unref();
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
