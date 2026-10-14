import assert from 'node:assert/strict';
import { Readable, Writable } from 'node:stream';
import test from 'node:test';
import handler from './[...path].js';

function makeRequest({ method = 'GET', url = '/api/auth/me', headers = {}, body = '' } = {}) {
  const request = Readable.from(body ? [Buffer.from(body)] : []);
  request.method = method;
  request.url = url;
  request.headers = headers;
  return request;
}

function makeResponse() {
  const chunks = [];
  const response = new Writable({
    write(chunk, encoding, callback) {
      chunks.push(Buffer.from(chunk));
      callback();
    },
  });
  response.headers = new Map();
  response.setHeader = (name, value) => response.headers.set(name.toLowerCase(), value);
  response.getHeader = (name) => response.headers.get(name.toLowerCase());
  response.bodyText = () => Buffer.concat(chunks).toString('utf8');
  return response;
}

async function runHandler(request) {
  const response = makeResponse();
  await handler(request, response);
  if (!response.writableEnded) {
    await new Promise((resolve, reject) => {
      response.once('finish', resolve);
      response.once('error', reject);
    });
  }
  return response;
}

test('proxies session cookies, origin, CSRF headers, query, and Set-Cookie responses', async (t) => {
  const priorBackend = process.env.BACKEND_API_URL;
  process.env.BACKEND_API_URL = 'https://crop-api.example';
  t.after(() => {
    if (priorBackend === undefined) delete process.env.BACKEND_API_URL;
    else process.env.BACKEND_API_URL = priorBackend;
  });

  let target;
  let forwardedHeaders;
  const priorFetch = globalThis.fetch;
  globalThis.fetch = async (url, options) => {
    target = url.toString();
    forwardedHeaders = options.headers;
    const headers = new Headers({ 'content-type': 'application/json' });
    headers.append('set-cookie', 'JSESSIONID=session; Path=/; HttpOnly; Secure; SameSite=Lax');
    headers.append('set-cookie', 'XSRF-TOKEN=csrf; Path=/; Secure; SameSite=Lax');
    return new Response('{"ok":true}', { status: 200, headers });
  };
  t.after(() => {
    globalThis.fetch = priorFetch;
  });

  const response = await runHandler(makeRequest({
    method: 'POST',
    url: '/api/crops?include=summary',
    headers: {
      cookie: 'JSESSIONID=session',
      host: 'app.example',
      origin: 'https://app.example',
      'x-xsrf-token': 'csrf',
    },
    body: '{"cropName":"Wheat"}',
  }));

  assert.equal(target, 'https://crop-api.example/api/crops?include=summary');
  assert.equal(forwardedHeaders.get('cookie'), 'JSESSIONID=session');
  assert.equal(forwardedHeaders.get('origin'), 'https://app.example');
  assert.equal(forwardedHeaders.get('x-xsrf-token'), 'csrf');
  assert.equal(forwardedHeaders.get('host'), null);
  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.getHeader('set-cookie'), [
    'JSESSIONID=session; Path=/; HttpOnly; Secure; SameSite=Lax',
    'XSRF-TOKEN=csrf; Path=/; Secure; SameSite=Lax',
  ]);
  assert.equal(response.bodyText(), '{"ok":true}');
});

test('does not call a backend when its production origin is not configured', async (t) => {
  const priorBackend = process.env.BACKEND_API_URL;
  delete process.env.BACKEND_API_URL;
  t.after(() => {
    if (priorBackend !== undefined) process.env.BACKEND_API_URL = priorBackend;
  });

  const response = await runHandler(makeRequest());
  assert.equal(response.statusCode, 503);
  assert.deepEqual(JSON.parse(response.bodyText()), {
    error: 'The backend API proxy is not configured.',
  });
});

test('rejects an insecure backend origin', async (t) => {
  const priorBackend = process.env.BACKEND_API_URL;
  process.env.BACKEND_API_URL = 'http://crop-api.example';
  t.after(() => {
    if (priorBackend === undefined) delete process.env.BACKEND_API_URL;
    else process.env.BACKEND_API_URL = priorBackend;
  });

  const response = await runHandler(makeRequest());
  assert.equal(response.statusCode, 500);
  assert.deepEqual(JSON.parse(response.bodyText()), {
    error: 'BACKEND_API_URL must be a valid HTTPS origin without credentials or a path.',
  });
});
