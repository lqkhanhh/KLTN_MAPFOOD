// Requires PostgreSQL pg_dump in PATH. Credentials go through env, never argv/logs.
const { spawnSync } = require('node:child_process');
const { mkdirSync, existsSync, writeFileSync, readFileSync } = require('node:fs');
const { resolve, join } = require('node:path');
const { createHash } = require('node:crypto');
const dotenv = require('dotenv');

const envPath = resolve(process.argv[2] || join(__dirname, '../.env'));
if (!existsSync(envPath)) throw new Error('Environment file not found');
const config = dotenv.parse(readFileSync(envPath));
if (!config.DATABASE_URL) throw new Error('Missing DATABASE_URL');
const url = new URL(config.DATABASE_URL);
if (!['postgres:', 'postgresql:'].includes(url.protocol)) throw new Error('Expected PostgreSQL URL');
const output = resolve(__dirname, '../../backups');
mkdirSync(output, { recursive: true });
const file = join(output, `routebite-${new Date().toISOString().replace(/[:.]/g, '-')}.dump`);
const env = { ...process.env, PGHOST: url.hostname, PGPORT: url.port || '5432',
  PGUSER: decodeURIComponent(url.username), PGPASSWORD: decodeURIComponent(url.password),
  PGDATABASE: decodeURIComponent(url.pathname.slice(1)), PGCONNECT_TIMEOUT: '20',
  PGSSLMODE: url.searchParams.get('sslmode') || 'prefer' };
const result = spawnSync('pg_dump', ['--format=custom', '--no-owner', '--no-acl', '--file', file], { env, encoding: 'utf8' });
if (result.error || result.status !== 0) {
  // Never print unfiltered database diagnostics: they may contain connection details.
  console.error('Backup failed. Check pg_dump is installed, its version is >= server version, network access and credentials. Incomplete dump must not be used.');
  process.exitCode = 1;
} else {
  const digest = createHash('sha256').update(readFileSync(file)).digest('hex');
  writeFileSync(`${file}.sha256`, `${digest}  ${file.split(/[\\/]/).pop()}\n`);
  console.log(`Backup saved: ${file}`);
  console.log('Copy the dump and checksum to private off-site storage; separately preserve the document encryption key. Restore-test before relying on this backup.');
}
