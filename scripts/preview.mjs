import http from 'node:http';
import path from 'node:path';
import { createReadStream } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';

// Local production verification only. Deploy dist/browser using the supplied Pages workflow.
const root = path.resolve('dist/browser');
const port = Number(process.env['PORT'] ?? 4300);
const base =
  process.env['BASE_PATH'] ??
  (await readFile(path.join(root, 'index.html'), 'utf8')).match(/<base href="([^"]+)"/)?.[1] ??
  '/';
const types = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.geojson': 'application/geo+json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.webm': 'video/webm',
  '.csv': 'text/csv',
};
http
  .createServer(async (request, response) => {
    try {
      const pathname = decodeURIComponent(
        new URL(request.url, `http://localhost:${port}`).pathname,
      );
      if (!pathname.startsWith(base)) {
        response.writeHead(404);
        response.end();
        return;
      }
      let file = path.resolve(root, pathname.slice(base.length) || 'index.html');
      if (file !== root && !file.startsWith(root + path.sep)) {
        response.writeHead(403);
        response.end();
        return;
      }
      let info;
      try {
        info = await stat(file);
      } catch {
        file = path.join(root, '404.html');
        info = await stat(file);
      }
      if (info.isDirectory()) {
        file = path.join(file, 'index.html');
        info = await stat(file);
      }
      const headers = {
        'Content-Type': types[path.extname(file)] ?? 'application/octet-stream',
        'Cache-Control': 'no-cache',
        'Accept-Ranges': 'bytes',
      };
      const range = request.headers.range?.match(/^bytes=(\d+)-(\d*)$/);
      let start = 0;
      let end = info.size - 1;
      if (range) {
        start = Number(range[1]);
        end = range[2] ? Math.min(Number(range[2]), end) : end;
        if (start > end) {
          response.writeHead(416, { 'Content-Range': `bytes */${info.size}` });
          response.end();
          return;
        }
        headers['Content-Range'] = `bytes ${start}-${end}/${info.size}`;
      }
      headers['Content-Length'] = end - start + 1;
      response.writeHead(range ? 206 : 200, headers);
      if (request.method === 'HEAD') response.end();
      else createReadStream(file, { start, end }).pipe(response);
    } catch {
      response.writeHead(500);
      response.end('Preview server error');
    }
  })
  .listen(port, '127.0.0.1', () =>
    console.log(`Production preview: http://localhost:${port}${base}`),
  );
