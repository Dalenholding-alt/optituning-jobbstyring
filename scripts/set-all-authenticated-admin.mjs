import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const root = path.resolve(path.dirname(__filename), '..');
const workerPath = path.join(root, 'src', 'worker.js');

const original = 'isAdmin: admins.length === 0 || admins.includes(email),';
const replacement = 'isAdmin: true,';

const source = await readFile(workerPath, 'utf8');

if (source.includes(replacement)) {
  console.log('Alle Cloudflare Access-godkjente brukere er allerede administratorer.');
  process.exit(0);
}

if (!source.includes(original)) {
  throw new Error('Fant ikke forventet administratorregel i src/worker.js.');
}

await writeFile(workerPath, source.replace(original, replacement), 'utf8');
console.log('Alle brukere som slipper gjennom Cloudflare Access settes som administratorer.');
