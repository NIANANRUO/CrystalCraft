import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

// Deliberately no SPA fallback: incorrect root asset URLs must fail in this test.
const root = path.resolve('dist');
const prefix = '/crystal-craft-test/';
const port = Number(process.env.TEST_PORT || 4174);
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript', '.css': 'text/css', '.svg': 'image/svg+xml' };
http.createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    if (!pathname.startsWith(prefix)) throw new Error('Wrong deployment base');
    const filename = path.resolve(root, pathname.slice(prefix.length) || 'index.html');
    if (!filename.startsWith(root + path.sep)) throw new Error('Outside dist');
    const content = await readFile(filename);
    response.writeHead(200, { 'Content-Type': mime[path.extname(filename)] || 'application/octet-stream' });
    response.end(content);
  } catch {
    response.writeHead(404);
    response.end('Not found');
  }
}).listen(port, '127.0.0.1', () => console.log(`Production test server: http://127.0.0.1:${port}/crystal-craft-test/`));
