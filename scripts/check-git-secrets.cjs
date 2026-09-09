// Kiểm tra snapshot trong Git, không in giá trị bí mật ra terminal.
// Đây là lớp phòng ngừa cơ bản, không thay thế công cụ quét bí mật chuyên dụng.
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const git = (args) => execFileSync('git', args, { maxBuffer: 80 * 1024 * 1024 });
const mode = process.argv.includes('--head') ? 'head' : process.argv.includes('--worktree') ? 'worktree' : 'index';
const files = git(mode === 'head' ? ['ls-tree', '-r', '--name-only', '-z', 'HEAD'] : ['ls-files', '-z']).toString().split('\0').filter(Boolean);
const issues = [];
const template = (name) => /^\.env(?:\..+)?\.(?:example|sample|template)$/.test(name) || ['.env.example', '.env.sample', '.env.template'].includes(name);
function forbidden(file) {
  const name = path.posix.basename(file);
  return ((name === '.env' || name.startsWith('.env.')) && !template(name)) ||
    /\.(key|pem|p12|pfx|keystore|log|dump|backup|bak|db|sqlite3?)$/i.test(name) ||
    /^id_(rsa|ed25519)/.test(name) || /^\.seed-.*-accounts\.json$/.test(name) ||
    /(?:service-account|firebase-adminsdk).*\.json$/i.test(name) || name === 'credentials.json' ||
    /(^|\/)(node_modules|dist|secrets|private|logs|backups|dumps|uploads|storage)(\/|$)/.test(file);
}

// So khớp khóa local đang dùng để phát hiện copy nhầm vào mã nguồn. Không log khóa.
const known = [];
for (const relative of ['.env', 'backend/.env', 'web/.env']) {
  if (!fs.existsSync(relative)) continue;
  for (const line of fs.readFileSync(relative, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (!match || !/SECRET|PASSWORD|TOKEN|API_KEY|ENCRYPTION|DATABASE_URL/.test(match[1])) continue;
    let value = match[2].replace(/^['"]|['"]$/g, '');
    if (value.length < 12 || /^(?:change[-_]?me|replace[_-]|your[_-]|<)/i.test(value)) continue;
    known.push({ label: match[1], value });
  }
}
const privateKeyPath = 'backend/.merchant-documents.key';
if (fs.existsSync(privateKeyPath)) known.push({ label: 'DOCUMENT_ENCRYPTION_KEY', value: fs.readFileSync(privateKeyPath, 'utf8').trim() });
const credentialsPath = 'backend/.seed-catalog-accounts.json';
if (fs.existsSync(credentialsPath)) {
  try { for (const account of JSON.parse(fs.readFileSync(credentialsPath, 'utf8')).accounts || []) if (account.password?.length >= 12) known.push({ label: 'SEED_ACCOUNT_PASSWORD', value: account.password }); }
  catch { issues.push('Cannot read local seed credential file safely.'); }
}
const signatures = [
  ['PRIVATE_KEY', /-----BEGIN (?:RSA |EC |OPENSSH |DSA |ENCRYPTED )?PRIVATE KEY-----/],
  ['GITHUB_TOKEN', /\b(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{40,})\b/],
  ['GOOGLE_API_KEY', /\bAIza[A-Za-z0-9_-]{35}\b/],
  ['AWS_ACCESS_KEY', /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/],
];
for (const file of files) {
  if (forbidden(file)) { issues.push(`${file}: file must not be tracked`); continue; }
  let buffer;
  try { buffer = mode === 'worktree' ? fs.readFileSync(file) : git(['show', mode === 'head' ? `HEAD:${file}` : `:${file}`]); }
  catch { issues.push(`${file}: cannot inspect file`); continue; }
  const text = buffer.toString('utf8');
  for (const item of known) if (item.value && text.includes(item.value)) issues.push(`${file}: contains local ${item.label}`);
  for (const [label, regex] of signatures) if (regex.test(text)) issues.push(`${file}: possible ${label}`);
}
if (issues.length) {
  console.error('BLOCKED: Git snapshot may contain sensitive/generated files. Values are redacted.');
  const unique = [...new Set(issues)];
  for (const issue of unique.slice(0, 30)) console.error('- ' + issue);
  if (unique.length > 30) console.error(`... ${unique.length - 30} additional findings (values redacted).`);
  process.exitCode = 1;
} else console.log(`PASS: ${files.length} ${mode} files checked; no blocked paths or detected secrets. History is NOT covered by this check.`);
