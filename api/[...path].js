import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

const methods = new Set(['GET', 'HEAD', 'POST', 'PUT', 'DELETE', 'OPTIONS']);
const removedHeaders = new Set([
  'accept-encoding',
  'connection',
  'content-length',
  'expect',
  'forwarded',
  'host',
  'keep-alive',
  'proxy-authorization',
  'te',
  'transfer-encoding',
  'upgrade',
  'x-forwarded-for',
  'x-forwarded-host',
  'x-forwarded-port',
  'x-forwarded-proto',
]);

export const config = {
  api: {
    bodyParser: false,
  },
};

function sendJson(response, status, body) {
  response.statusCode = status;
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.end(JSON.stringify(body));
}

export default async function handler(request, response) {
  const method = (request.method || 'GET').toUpperCase();
  if (!methods.has(method)) {
    response.setHeader('Allow', [...methods].join(', '));
    sendJson(response, 405, { error: 'HTTP method is not supported by the API proxy.' });
    return;
  }

  const configuredBackend = process.env.BACKEND_API_URL;
  if (!configuredBackend) {
    sendJson(response, 503, { error: 'The backend API proxy is not configured.' });
    return;
  }

  let backend;
  try {
    backend = new URL(configuredBackend);
  } catch {
    sendJson(response, 500, { error: 'BACKEND_API_URL must be a valid HTTPS origin.' });
    return;
  }

  if (backend.protocol !== 'https:' || backend.pathname !== '/' || backend.search || backend.hash || backend.username || backend.password) {
    sendJson(response, 500, { error: 'BACKEND_API_URL must be a valid HTTPS origin without credentials or a path.' });
    return;
  }

  const incoming = new URL(request.url || '/', 'https://vercel.invalid');
  const apiPath = incoming.pathname.startsWith('/api/')
    ? incoming.pathname
    : incoming.pathname === '/api' || incoming.pathname === '/'
      ? '/api'
      : `/api${incoming.pathname}`;
  const target = new URL(`${apiPath}${incoming.search}`, backend.origin);
  const headers = new Headers(request.headers);
  for (const name of removedHeaders) headers.delete(name);

  const hasBody = method !== 'GET' && method !== 'HEAD';
  try {
    const upstream = await fetch(target, {
      method,
      headers,
      body: hasBody ? request : undefined,
      ...(hasBody ? { duplex: 'half' } : {}),
      redirect: 'manual',
    });

    response.statusCode = upstream.status;
    for (const [name, value] of upstream.headers) {
      if (!['connection', 'content-encoding', 'content-length', 'keep-alive', 'transfer-encoding'].includes(name.toLowerCase())
        && name.toLowerCase() !== 'set-cookie') {
        response.setHeader(name, value);
      }
    }

    const cookies = upstream.headers.getSetCookie();
    if (cookies.length) response.setHeader('Set-Cookie', cookies);

    if (!upstream.body || method === 'HEAD') {
      response.end();
      return;
    }

    await pipeline(Readable.fromWeb(upstream.body), response);
  } catch (error) {
    console.error('API proxy request failed:', error.message);
    if (response.headersSent) {
      response.destroy(error);
      return;
    }
    sendJson(response, 502, { error: 'The backend API could not be reached.' });
  }
}
