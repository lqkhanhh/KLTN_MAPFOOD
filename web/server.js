import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, resolve, relative, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('.', import.meta.url)));
try { process.loadEnvFile(join(root, '.env')); } catch (error) { if (error.code !== 'ENOENT') throw error; }
const port = Number(process.env.PORT || 4173);
const host = '127.0.0.1';

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.ico': 'image/x-icon',
};

createServer(async (req, res) => {
  try {
    const url = new URL(req.url || '/', `http://${req.headers.host || host}`);
    let pathname = decodeURIComponent(url.pathname);
    // Config and service credentials must never be served as static files.
    if (pathname.split(/[\\/]/).some(part => part.startsWith('.') || ['node_modules', 'secrets', 'private', 'credentials.json'].includes(part.toLowerCase()) || /service-account|firebase-adminsdk/i.test(part)) || !['', ...Object.keys(mimeTypes), '.woff2', '.woff'].includes(extname(pathname).toLowerCase())) {
      res.writeHead(404); res.end(); return;
    }
    if (pathname === '/maps-config.json') {
      res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
      res.end(JSON.stringify({ googleMapsApiKey: process.env.GOOGLE_MAPS_BROWSER_KEY || '' }));
      return;
    }
    if (pathname === '/') pathname = '/index.html';

    const filePath = join(root, pathname);
    const relativePath = relative(root, filePath);
    if (relativePath.startsWith('..') || isAbsolute(relativePath)) { res.writeHead(404); res.end(); return; }
    const content = await readFile(filePath);
    const ext = extname(filePath).toLowerCase();

    res.writeHead(200, {
      'Content-Type': mimeTypes[ext] || 'application/octet-stream',
      'Cache-Control': 'no-store',
    });
    res.end(content);
  } catch {
    try {
      const content = await readFile(join(root, 'index.html'));
      res.writeHead(200, {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store',
      });
      res.end(content);
    } catch {
      res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('RouteBite web server error');
    }
  }
}).listen(port, host, () => {
  console.log(`RouteBite web server listening on http://${host}:${port}`);
});
