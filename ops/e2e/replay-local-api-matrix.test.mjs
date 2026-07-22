import test from 'node:test';
import assert from 'node:assert/strict';
import { validateLoopbackUrl } from './replay-local-api-matrix.mjs';

test('only accepts an exact HTTP loopback base URL', () => {
  assert.equal(validateLoopbackUrl('http://127.0.0.1:8080'), 'http://127.0.0.1:8080');
  assert.equal(validateLoopbackUrl('http://localhost:8081'), 'http://localhost:8081');
  for (const value of ['https://localhost:8080', 'http://example.com:8080', 'http://user@localhost:8080', 'http://localhost:8080/api', 'http://localhost:8080/?x=1', 'http://localhost:8080/#x', 'http://localhost']) {
    assert.throws(() => validateLoopbackUrl(value));
  }
});
