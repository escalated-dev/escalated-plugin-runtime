import type { EndpointRequest } from '@escalated-dev/plugin-sdk';

type HttpRequest = EndpointRequest & { httpContract?: 1; rawBody?: Uint8Array; clientIp?: string };

/** Decode host transport fields once, preserving signed bytes independently of parsed body. */
export function decodeHttpRequest(input: Record<string, unknown>): HttpRequest {
  const headers: Record<string, string> = {};
  if (
    input.headers !== undefined &&
    (!input.headers || typeof input.headers !== 'object' || Array.isArray(input.headers))
  ) {
    throw new TypeError('Invalid request headers.');
  }
  for (const [name, value] of Object.entries(input.headers ?? {})) {
    const lower = name.toLowerCase();
    // Older framework bridges send arrays. Multiple values remain visible so
    // signature handlers cannot silently accept one of conflicting signatures.
    const scalar = Array.isArray(value) && value.every((item) => typeof item === 'string') ? value.join(', ') : value;
    if (typeof scalar !== 'string' || Object.hasOwn(headers, lower)) {
      throw new TypeError('Invalid or duplicate request header.');
    }
    Object.defineProperty(headers, lower, { value: scalar, enumerable: true });
  }
  const request: HttpRequest = {
    body: input.body,
    params: (input.params ?? {}) as Record<string, string>,
    query: (input.query ?? {}) as Record<string, string>,
    headers,
  };
  if (input.httpContract === undefined) return request;
  if (input.httpContract !== 1 || typeof input.rawBodyBase64 !== 'string') {
    throw new TypeError('Unsupported or incomplete plugin HTTP contract.');
  }
  const bytes = Buffer.from(input.rawBodyBase64, 'base64');
  if (bytes.toString('base64') !== input.rawBodyBase64) {
    throw new TypeError('Request body must use canonical base64.');
  }
  request.httpContract = 1;
  request.rawBody = bytes;
  if (input.clientIp !== undefined) {
    if (typeof input.clientIp !== 'string') throw new TypeError('Invalid client address.');
    request.clientIp = input.clientIp;
  }
  return request;
}
