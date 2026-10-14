import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const config = JSON.parse(await readFile(new URL('../vercel.json', import.meta.url), 'utf8'));

function rewritePath(path) {
  for (const rewrite of config.rewrites) {
    const sourcePattern = new RegExp(`^${rewrite.source.replace(':path*', '(.*)')}$`);
    const match = path.match(sourcePattern);
    if (match) return rewrite.destination.replace(':path*', match[1]);
  }
  return null;
}

test('Vercel forwards the frontend CSRF URL to the exact Spring endpoint', () => {
  assert.equal(
    rewritePath('/api/auth/csrf'),
    'https://crop-harvesting-backend.onrender.com/api/auth/csrf',
  );
});

test('Vercel forwards crop and harvest URLs without adding another API prefix', () => {
  assert.equal(
    rewritePath('/api/crops/42'),
    'https://crop-harvesting-backend.onrender.com/api/crops/42',
  );
  assert.equal(
    rewritePath('/api/harvests/7'),
    'https://crop-harvesting-backend.onrender.com/api/harvests/7',
  );
});

test('Vercel configuration contains a single same-origin API proxy rule', () => {
  assert.equal(config.rewrites.length, 1);
  assert.equal(config.rewrites[0].source, '/api/:path*');
  assert.equal(
    new URL(config.rewrites[0].destination.replace(':path*', 'auth/csrf')).pathname,
    '/api/auth/csrf',
  );
});
