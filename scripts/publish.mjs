import { existsSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(__filename), '..');
const WRANGLER_FILE = path.join(ROOT, 'wrangler.jsonc');
const DATABASE_NAME = 'optituning-jobbstyring';
const NPX = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const NPM = process.platform === 'win32' ? 'npm.cmd' : 'npm';

function printHeading(text) {
  console.log(`\n=== ${text} ===`);
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: options.capture ? ['inherit', 'pipe', 'pipe'] : 'inherit',
    env: process.env
  });

  if (options.capture) {
    return {
      ok: result.status === 0,
      status: result.status,
      stdout: result.stdout || '',
      stderr: result.stderr || ''
    };
  }

  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(' ')} feilet med status ${result.status ?? 'ukjent'}`);
  }
  return result;
}

function parseJsonOutput(text) {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const arrayStart = trimmed.indexOf('[');
    const arrayEnd = trimmed.lastIndexOf(']');
    if (arrayStart >= 0 && arrayEnd > arrayStart) {
      return JSON.parse(trimmed.slice(arrayStart, arrayEnd + 1));
    }
    const objectStart = trimmed.indexOf('{');
    const objectEnd = trimmed.lastIndexOf('}');
    if (objectStart >= 0 && objectEnd > objectStart) {
      return JSON.parse(trimmed.slice(objectStart, objectEnd + 1));
    }
    throw new Error('Kunne ikke lese JSON-svaret fra Wrangler.');
  }
}

async function ensureDependencies() {
  if (existsSync(path.join(ROOT, 'node_modules', 'wrangler'))) return;
  printHeading('Installerer nødvendige pakker');
  run(NPM, ['install']);
}

function ensureCloudflareLogin() {
  printHeading('Kontrollerer Cloudflare-innlogging');
  const whoami = run(NPX, ['wrangler', 'whoami'], { capture: true });
  if (whoami.ok) {
    process.stdout.write(whoami.stdout);
    return;
  }

  if (process.env.CI || process.env.GITHUB_ACTIONS) {
    process.stderr.write(whoami.stderr);
    throw new Error('Cloudflare-autentisering feilet i GitHub Actions. Kontroller CLOUDFLARE_API_TOKEN og CLOUDFLARE_ACCOUNT_ID.');
  }

  console.log('Du er ikke logget inn. Nettleseren åpnes for Cloudflare-innlogging.');
  run(NPX, ['wrangler', 'login']);
}

function listDatabases() {
  const result = run(NPX, ['wrangler', 'd1', 'list', '--json'], { capture: true });
  if (!result.ok) {
    process.stderr.write(result.stderr);
    throw new Error('Kunne ikke hente D1-databaser fra Cloudflare.');
  }
  const parsed = parseJsonOutput(result.stdout);
  return Array.isArray(parsed) ? parsed : (parsed.result || []);
}

function databaseId(database) {
  return database?.uuid || database?.id || database?.database_id || '';
}

function findDatabase(databases) {
  return databases.find(database => database.name === DATABASE_NAME || database.database_name === DATABASE_NAME);
}

function ensureDatabase() {
  printHeading('Klargjør D1-database i EU');
  let database = findDatabase(listDatabases());

  if (!database) {
    run(NPX, ['wrangler', 'd1', 'create', DATABASE_NAME, '--jurisdiction', 'eu']);
    database = findDatabase(listDatabases());
  }

  const id = databaseId(database);
  if (!id) throw new Error('Fant databasen, men kunne ikke lese database-ID-en.');
  console.log(`Bruker database: ${DATABASE_NAME} (${id})`);
  return id;
}

async function updateWrangler(databaseIdValue) {
  const raw = await readFile(WRANGLER_FILE, 'utf8');
  const config = JSON.parse(raw);
  config.d1_databases = config.d1_databases || [];

  let binding = config.d1_databases.find(item => item.binding === 'DB');
  if (!binding) {
    binding = { binding: 'DB' };
    config.d1_databases.push(binding);
  }

  binding.database_name = DATABASE_NAME;
  binding.database_id = databaseIdValue;
  binding.preview_database_id = binding.preview_database_id || 'optituning-local';
  binding.migrations_dir = 'migrations';

  await writeFile(WRANGLER_FILE, `${JSON.stringify(config, null, 2)}\n`, 'utf8');
  console.log('wrangler.jsonc er oppdatert med riktig database-ID.');
}

function applyMigrations() {
  printHeading('Oppretter tabeller og indekser');
  run(NPX, ['wrangler', 'd1', 'migrations', 'apply', 'DB', '--remote']);
}

function deploy() {
  printHeading('Publiserer Optituning Jobbstyring');
  run(NPX, ['wrangler', 'deploy']);
}

async function main() {
  console.log('Optituning Jobbstyring – Cloudflare-publisering');
  console.log('Løsningen publiseres som Worker med statiske filer og D1-database.');

  await ensureDependencies();
  ensureCloudflareLogin();
  const id = ensureDatabase();
  await updateWrangler(id);
  applyMigrations();
  deploy();

  printHeading('Publisering fullført – tilgang må aktiveres');
  console.log('1. Åpne Cloudflare Dashboard → Workers & Pages → optituning-jobbstyring.');
  console.log('2. Gå til Settings → Domains & Routes og aktiver Cloudflare Access på workers.dev-ruten.');
  console.log('3. Tillat e-postadressene til Steffen, Henrik, Sæter og øvrige brukere.');
  console.log('4. Kopier Team domain og AUD-tag fra Access-oppsettet.');
  console.log('5. Kjør: npx wrangler secret put TEAM_DOMAIN');
  console.log('6. Kjør: npx wrangler secret put POLICY_AUD');
  console.log('Etter dette er appen låst til godkjente brukere og klar til ordinær bruk.');
}

main().catch(error => {
  console.error(`\nPublisering stoppet: ${error.message}`);
  process.exitCode = 1;
});
