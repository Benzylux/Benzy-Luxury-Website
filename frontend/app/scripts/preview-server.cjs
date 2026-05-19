const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const port = Number(process.env.PORT || 4173);
const distDir = path.resolve(__dirname, '..', 'dist');

const contentTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp'
};

function sendFile(res, filePath) {
  fs.readFile(filePath, (error, data) => {
    if (error) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Not found');
      return;
    }

    res.writeHead(200, {
      'Cache-Control': filePath.includes(`${path.sep}assets${path.sep}`) ? 'public, max-age=31536000, immutable' : 'no-store',
      'Content-Type': contentTypes[path.extname(filePath)] || 'application/octet-stream'
    });
    res.end(data);
  });
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  const decodedPath = decodeURIComponent(url.pathname);
  const safePath = decodedPath.replace(/^\/+/, '');
  const requestedPath = path.resolve(distDir, safePath);
  const indexPath = path.join(distDir, 'index.html');

  if (!requestedPath.startsWith(distDir)) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Forbidden');
    return;
  }

  fs.stat(requestedPath, (error, stats) => {
    if (!error && stats.isFile()) {
      sendFile(res, requestedPath);
      return;
    }
    sendFile(res, indexPath);
  });
});

server.listen(port, () => {
  console.log(`Benzy Luxury preview running at http://localhost:${port}`);
});
