import { fileURLToPath } from 'node:url';

process.env.DOTENV_CONFIG_PATH ??= fileURLToPath(new URL('../.env', import.meta.url));
process.env.NODE_ENV = 'production';
await import('../src/index.js');
