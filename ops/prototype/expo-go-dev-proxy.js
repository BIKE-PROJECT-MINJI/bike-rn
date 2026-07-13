#!/usr/bin/env node

const http = require('http');
const fs = require('fs');
const net = require('net');
const path = require('path');

const LISTEN_HOST = process.env.EXPO_PROXY_HOST || '0.0.0.0';
const LISTEN_PORT = Number(process.env.EXPO_PROXY_PORT || 18080);
const BACKEND_ORIGIN = new URL(process.env.BACKEND_ORIGIN || 'http://127.0.0.1:8080');
const METRO_ORIGIN = new URL(process.env.METRO_ORIGIN || 'http://127.0.0.1:8081');
const PROTOTYPE_ARTIFACTS_DIR = path.resolve(__dirname, '../../../../ARTIFACTS/expo-go-prototype-2026-06-24');
const PROTOTYPE_DASHBOARD_FILE = '폰_테스트_대시보드.html';

const BACKEND_PREFIXES = [
  '/api/',
  '/health',
  '/actuator',
];

function targetForPath(pathname) {
  return BACKEND_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(prefix))
    ? BACKEND_ORIGIN
    : METRO_ORIGIN;
}

function publicOriginFor(req) {
  const host = req.headers['x-forwarded-host'] || req.headers.host || `127.0.0.1:${LISTEN_PORT}`;
  const proto = req.headers['x-forwarded-proto'] || 'http';
  return `${proto}://${host}`;
}

function publicHostFor(req) {
  return publicOriginFor(req).replace(/^https?:\/\//, '');
}

function shouldRewriteResponse(headers) {
  const contentType = String(headers['content-type'] || '');
  return Boolean(headers['expo-protocol-version'])
    || contentType.includes('json')
    || contentType.includes('text/html')
    || contentType.includes('text/plain');
}

function rewriteMetroBody(body, req) {
  const publicOrigin = publicOriginFor(req).replace(/\/+$/, '');
  const publicHost = publicHostFor(req);
  const escapedMetroHost = METRO_ORIGIN.host.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const escapedMetroHostname = METRO_ORIGIN.hostname.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  return body
    .replace(new RegExp(`https?://${escapedMetroHost}`, 'g'), publicOrigin)
    .replace(new RegExp(`https?://${escapedMetroHostname}:${METRO_ORIGIN.port}`, 'g'), publicOrigin)
    .replace(/https?:\/\/localhost:8081/g, publicOrigin)
    .replace(/https?:\/\/127\.0\.0\.1:8081/g, publicOrigin)
    .replace(/https?:\/\/[^"'\s]+:8081/g, publicOrigin)
    .replace(/"hostUri":"[^"]+:8081"/g, `"hostUri":"${publicHost}"`)
    .replace(/"debuggerHost":"[^"]+:8081"/g, `"debuggerHost":"${publicHost}"`);
}

function contentTypeFor(filePath) {
  const extension = path.extname(filePath).toLowerCase();
  switch (extension) {
    case '.html':
      return 'text/html; charset=utf-8';
    case '.md':
      return 'text/markdown; charset=utf-8';
    case '.png':
      return 'image/png';
    case '.svg':
      return 'image/svg+xml; charset=utf-8';
    case '.txt':
      return 'text/plain; charset=utf-8';
    default:
      return 'application/octet-stream';
  }
}

function servePrototypeArtifact(req, res, pathname) {
  if (pathname === '/prototype-dashboard' || pathname === '/prototype-dashboard/') {
    const encodedDashboard = encodeURIComponent(PROTOTYPE_DASHBOARD_FILE);
    res.writeHead(302, { location: `/prototype-artifacts/${encodedDashboard}` });
    res.end();
    return true;
  }

  if (!pathname.startsWith('/prototype-artifacts/')) {
    return false;
  }

  const encodedRelativePath = pathname.replace('/prototype-artifacts/', '');
  let relativePath;
  try {
    relativePath = decodeURIComponent(encodedRelativePath);
  } catch {
    res.writeHead(400, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('Invalid artifact path');
    return true;
  }

  const filePath = path.resolve(PROTOTYPE_ARTIFACTS_DIR, relativePath);
  if (!filePath.startsWith(PROTOTYPE_ARTIFACTS_DIR + path.sep)) {
    res.writeHead(403, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('Forbidden');
    return true;
  }

  fs.stat(filePath, (statError, stat) => {
    if (statError || !stat.isFile()) {
      res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
      res.end('File not found');
      return;
    }

    res.writeHead(200, {
      'content-type': contentTypeFor(filePath),
      'cache-control': 'no-store',
    });

    if (req.method === 'HEAD') {
      res.end();
      return;
    }

    fs.createReadStream(filePath).pipe(res);
  });

  return true;
}

function proxyHttp(req, res) {
  const requestUrl = new URL(req.url, 'http://placeholder.local');
  if (servePrototypeArtifact(req, res, requestUrl.pathname)) {
    return;
  }

  const target = targetForPath(requestUrl.pathname);
  const isMetro = target === METRO_ORIGIN;
  const targetPath = `${requestUrl.pathname}${requestUrl.search}`;

  const headers = {
    ...req.headers,
    host: target.host,
    'x-forwarded-host': req.headers.host,
    'x-forwarded-proto': req.headers['x-forwarded-proto'] || 'http',
  };

  const upstream = http.request(
    {
      hostname: target.hostname,
      port: target.port,
      path: targetPath,
      method: req.method,
      headers,
    },
    (upstreamRes) => {
      const responseHeaders = { ...upstreamRes.headers };

      if (!isMetro || !shouldRewriteResponse(responseHeaders)) {
        res.writeHead(upstreamRes.statusCode || 502, responseHeaders);
        upstreamRes.pipe(res);
        return;
      }

      const chunks = [];
      upstreamRes.on('data', (chunk) => chunks.push(chunk));
      upstreamRes.on('end', () => {
        const body = Buffer.concat(chunks).toString('utf8');
        const rewritten = rewriteMetroBody(body, req);
        delete responseHeaders['content-length'];
        res.writeHead(upstreamRes.statusCode || 502, responseHeaders);
        res.end(rewritten);
      });
    }
  );

  upstream.on('error', (error) => {
    res.writeHead(502, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ code: 502, message: error.message, data: null }));
  });

  req.pipe(upstream);
}

function proxyUpgrade(req, socket, head) {
  const requestUrl = new URL(req.url, 'http://placeholder.local');
  const target = targetForPath(requestUrl.pathname);
  const upstream = net.connect(Number(target.port), target.hostname, () => {
    const headers = [
      `${req.method} ${req.url} HTTP/${req.httpVersion}`,
      ...Object.entries(req.headers).map(([key, value]) => `${key}: ${value}`),
      '',
      '',
    ].join('\r\n');
    upstream.write(headers);
    if (head.length > 0) {
      upstream.write(head);
    }
    socket.pipe(upstream).pipe(socket);
  });

  upstream.on('error', () => socket.destroy());
}

const server = http.createServer(proxyHttp);
server.on('upgrade', proxyUpgrade);
server.listen(LISTEN_PORT, LISTEN_HOST, () => {
  console.log(`expo-go-dev-proxy listening on http://${LISTEN_HOST}:${LISTEN_PORT}`);
  console.log(`backend -> ${BACKEND_ORIGIN.href}`);
  console.log(`metro   -> ${METRO_ORIGIN.href}`);
});
