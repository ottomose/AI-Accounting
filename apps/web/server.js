import { createServer } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { join, extname } from 'node:path';

const PORT = process.env.PORT || 3000;
const DIST = join(import.meta.dirname, 'dist');
const API_URL = process.env.API_URL || 'http://localhost:3000';

const MIME = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

createServer((req, res) => {
  let filePath = join(DIST, req.url === '/' ? 'index.html' : req.url);

  if (!existsSync(filePath)) {
    filePath = join(DIST, 'index.html');
  }

  try {
    const ext = extname(filePath);
    if (ext === '.html' || !ext) {
      const html = readFileSync(join(DIST, 'index.html'), 'utf-8');
      const injected = html.replace(
        '<head>',
        `<head><script>window.__API_URL__="${API_URL}"</script>`
      );
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(injected);
    } else {
      const data = readFileSync(filePath);
      res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
      res.end(data);
    }
  } catch {
    const html = readFileSync(join(DIST, 'index.html'), 'utf-8');
    const injected = html.replace(
      '<head>',
      `<head><script>window.__API_URL__="${API_URL}"</script>`
    );
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(injected);
  }
}).listen(PORT, '0.0.0.0', () => {
  console.log(`Serving on port ${PORT}`);
});
