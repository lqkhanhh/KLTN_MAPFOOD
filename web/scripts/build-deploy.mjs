// Publish only explicitly selected browser assets; never copy .env or source folders.
import { build } from 'esbuild';
import { readFile, writeFile, mkdir, readdir, copyFile, cp, rm } from 'node:fs/promises';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const output = resolve(root, 'dist');
const api = process.env.PUBLIC_API_BASE?.replace(/\/$/, '');
if (!api) throw new Error('Set PUBLIC_API_BASE to https://your-backend.onrender.com/api');
const url = new URL(api);
if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || url.pathname !== '/api') {
  throw new Error('PUBLIC_API_BASE must be an HTTPS origin followed by /api, without credentials or query parameters');
}
let html = await readFile(join(root, 'index.html'), 'utf8');
if (!/apiBase:\s*'[^']*'/.test(html)) throw new Error('Missing apiBase configuration in index.html');
html = html.replace(/apiBase:\s*'[^']*'/, `apiBase: ${JSON.stringify(api).replace(/</g, '\\u003c')}`);
// This exact output directory belongs to this build. Check before recursive removal.
if (output !== join(root, 'dist')) throw new Error('Invalid output directory');
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
await build({ entryPoints: [join(root, 'src/entry.jsx')], bundle: true, outfile: join(output, 'app.js'),
  format: 'iife', jsx: 'automatic', minify: true, define: { 'process.env.NODE_ENV': '"production"' } });
await writeFile(join(output, 'index.html'), html);
for (const entry of await readdir(root, { withFileTypes: true })) {
  if (entry.isFile() && entry.name.endsWith('.css')) await copyFile(join(root, entry.name), join(output, entry.name));
}
await cp(join(root, 'fonts'), join(output, 'fonts'), { recursive: true });
await writeFile(join(output, 'maps-config.json'), JSON.stringify({ googleMapsApiKey: process.env.GOOGLE_MAPS_BROWSER_KEY || '' }));
console.log('Built web/dist: production bundle, HTML, styles, fonts, public Maps configuration only.');
