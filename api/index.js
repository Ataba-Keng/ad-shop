import 'dotenv/config';
import express from 'express';
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createApplication, addFinalHandlers } from '../server/src/app.js';
import { config } from '../server/src/config.js';
import { createSsrHandler } from '../server/src/ssr.js';
import { assertCommerceConfiguration } from '../server/src/services/commerce-data.js';

const apiDirectory = dirname(fileURLToPath(import.meta.url));
const projectDirectory = resolve(apiDirectory, '..');
const clientDirectory = join(projectDirectory, 'client');
const clientDist = join(clientDirectory, 'dist');

if (config.nodeEnv === 'production') {
  assertCommerceConfiguration();
  if (!existsSync(join(clientDist, 'index.html')) || !existsSync(join(clientDist, 'server', 'entry-server.js'))) {
    throw new Error('Le build client/SSR manque.');
  }
}

const app = createApplication();
if (config.nodeEnv === 'production') {
  app.use('/assets', express.static(join(clientDist, 'assets'), { maxAge: '1y', immutable: true }));
  app.use(express.static(clientDist, { index: false, maxAge: '1h' }));
}
app.use(createSsrHandler({ vite: null, clientDir: clientDirectory, clientDist }));
addFinalHandlers(app);

export default app;
