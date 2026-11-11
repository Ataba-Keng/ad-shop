import 'dotenv/config';
import { createServer } from 'node:http';
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { createApplication, addFinalHandlers } from './app.js';
import { config } from './config.js';
import { AppError } from './lib/errors.js';
import { createSsrHandler } from './ssr.js';
import { assertCommerceConfiguration } from './services/commerce-data.js';

const serverDirectory = dirname(fileURLToPath(import.meta.url));
const projectDirectory = resolve(serverDirectory, '../..');
const clientDirectory = join(projectDirectory, 'client');
const clientDist = join(clientDirectory, 'dist');

async function start() {
  const app = createApplication();
  const server = createServer(app);
  let vite;

  if (config.nodeEnv === 'production') {
    assertCommerceConfiguration();
    if (!existsSync(join(clientDist, 'index.html')) || !existsSync(join(clientDist, 'server', 'entry-server.js'))) {
      throw new Error('Le build client/SSR manque. Lancez « pnpm build » avant le démarrage de production.');
    }
    app.use('/assets', express.static(join(clientDist, 'assets'), { maxAge: '1y', immutable: true }));
    app.use(express.static(clientDist, { index: false, maxAge: '1h' }));
  } else {
    const { createServer: createViteServer } = await import('vite');
    vite = await createViteServer({
      configFile: join(clientDirectory, 'vite.config.js'),
      root: clientDirectory,
      appType: 'custom',
      server: {
        middlewareMode: true,
        ws: { server },
      },
    });
    app.use(vite.middlewares);
    server.on('close', () => vite?.close());
  }

  app.use(createSsrHandler({ vite, clientDir: clientDirectory, clientDist }));
  addFinalHandlers(app);

  server.listen(config.port, '0.0.0.0', () => {
    const mode = config.demoMode ? 'public demo data only; admin auth remains disabled' : 'Supabase connected';
    console.log(`AD Shop listening on port ${config.port} (${config.nodeEnv}; ${mode})`);
  });

  const shutdown = () => server.close(() => process.exit(0));
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
}

start().catch((error) => {
  const code = error instanceof AppError ? error.code : 'STARTUP_ERROR';
  console.error(`[${code}] ${error.message}`);
  process.exitCode = 1;
});
