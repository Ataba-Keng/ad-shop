import { readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const scriptDirectory = fileURLToPath(new URL('.', import.meta.url));
const sourceDirectory = join(scriptDirectory, '..', 'src');
const serverDirectory = join(scriptDirectory, '..');
const javascriptFiles = [];

function collect(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) collect(path);
    else if (entry.isFile() && /\.(?:m?js)$/.test(path)) javascriptFiles.push(path);
  }
}

collect(sourceDirectory);
collect(scriptDirectory);
javascriptFiles.sort();

for (const path of javascriptFiles) {
  const result = spawnSync(process.execPath, ['--check', path], { stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status || 1);
  console.log(`Syntaxe OK : ${relative(serverDirectory, path)}`);
}

console.log(`${javascriptFiles.length} fichiers JavaScript serveur vérifiés.`);
