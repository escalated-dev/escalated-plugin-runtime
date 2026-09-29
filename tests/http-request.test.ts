import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { decodeHttpRequest } from '../src/http-request.js';

describe('HTTP request transport', () => {
  it('preserves whitespace, unicode, null and invalid UTF-8 bytes exactly', () => {
    const bytes = Buffer.concat([Buffer.from(' {"text": "📦"} \r\n'), Buffer.from([0, 255, 128])]);
    const request = decodeHttpRequest({ httpContract: 1, rawBodyBase64: bytes.toString('base64'), body: { text: 'different' } });
    assert.deepEqual(request.rawBody, bytes);
    assert.deepEqual(request.body, { text: 'different' });
    assert.equal(decodeHttpRequest({ httpContract: 1, rawBodyBase64: '' }).rawBody?.length, 0);
  });

  it('normalizes legacy headers without silently selecting duplicate values', () => {
    const request = decodeHttpRequest({ headers: { 'X-Slack-Signature': ['a', 'b'], Accept: ['application/json'] } });
    assert.equal(request.headers['x-slack-signature'], 'a, b');
    assert.equal(request.headers.accept, 'application/json');
    assert.throws(() => decodeHttpRequest({ headers: { Accept: 'a', accept: 'b' } }), TypeError);
    assert.throws(() => decodeHttpRequest({ headers: { Accept: [42] } }), TypeError);
  });

  it('never synthesizes raw input for older hosts', () => {
    const request = decodeHttpRequest({ body: { text: 'message' }, rawBodyBase64: 'YQ==', headers: {} });
    assert.equal(request.rawBody, undefined);
    assert.equal(request.httpContract, undefined);
  });

  it('rejects malformed or missing versioned bodies before plugin dispatch', () => {
    for (const fields of [
      { httpContract: 2, rawBodyBase64: '' }, { httpContract: 1 },
      { httpContract: 1, rawBodyBase64: 'YQ' }, { httpContract: 1, rawBodyBase64: 'YQ==\n' },
      { httpContract: 1, rawBodyBase64: '!!' }, { httpContract: 1, rawBodyBase64: null },
      { httpContract: 1, rawBodyBase64: '', clientIp: ['untrusted'] },
    ]) assert.throws(() => decodeHttpRequest(fields), TypeError);
  });
});
