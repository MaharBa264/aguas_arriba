// Minimal static server for local use: node serve.js, then open http://localhost:8123
// Served over http the simulation runs in a worker. Opened as a file, some browsers block it.
const http = require('http'), fs = require('fs'), path = require('path');
const root = path.join(__dirname, 'public'), port = Number(process.env.PORT) || 8123;
const types = {'.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8'};

http.createServer((request, response) => {
  const name = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
  const file = path.join(root, name === '/' ? 'index.html' : name);
  // Only files inside public/, and none of its dot-folders.
  if (!file.startsWith(root + path.sep) || name.split('/').some(part => part.startsWith('.'))) {
    response.writeHead(403).end();
    return;
  }
  fs.readFile(file, (error, data) => {
    if (error) { response.writeHead(404).end('No encontrado'); return; }
    response.writeHead(200, {'Content-Type': types[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store'});
    response.end(data);
  });
}).listen(port, '127.0.0.1', () => console.log(`Aguas arriba en http://localhost:${port}`));
