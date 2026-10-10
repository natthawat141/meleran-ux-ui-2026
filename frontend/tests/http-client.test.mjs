import assert from 'node:assert/strict';
import test from 'node:test';
import { createHttpClient, HttpClientError } from '../packages/api-client/src/index.ts';

const json = (value, status = 200) =>
  new Response(JSON.stringify(value), {
    status,
    headers: { 'content-type': 'application/json' },
  });
const identity = (payload) => payload;
const client = (fetcher, overrides = {}) =>
  createHttpClient({
    baseUrl: '/test-api/v1',
    fetcher,
    headers: {},
    credentials: 'omit',
    timeoutMs: null,
    ...overrides,
  });

function isError(kind, status) {
  return (error) =>
    error instanceof HttpClientError && error.kind === kind && error.status === status;
}

test('joins requests below the configured absolute base path without changing payload shape', async () => {
  const http = client(
    async (url) => {
      assert.equal(url, 'https://api.example.test/gateway/v1/records/a%2Fb?view=compact');
      return json([{ id: 'a/b' }]);
    },
    { baseUrl: 'https://api.example.test/gateway/v1/' },
  );
  assert.deepEqual(await http.request('/records/a%2Fb?view=compact', { decoder: identity }), [
    { id: 'a/b' },
  ]);
});

test('keeps a root-relative base relative and rejects paths escaping its configured scope', async () => {
  let calls = 0;
  const http = client(async (url) => {
    calls += 1;
    assert.equal(url, '/test-api/v1/records');
    return json(null);
  });
  assert.equal(await http.request('records', { decoder: identity }), null);
  for (const path of [
    '../records',
    '/%2e%2e/records',
    '//another.example/records',
    'https://another.example/records',
    '\\records',
  ]) {
    await assert.rejects(http.request(path, { decoder: identity }), isError('configuration'));
  }
  assert.equal(calls, 1);
});

test('requires explicit base URL, credentials and timeout choices', () => {
  const options = {
    baseUrl: '/explicit',
    fetcher: async () => json({}),
    headers: {},
    credentials: 'omit',
    timeoutMs: null,
  };
  for (const override of [
    { baseUrl: undefined },
    { baseUrl: '' },
    { credentials: undefined },
    { timeoutMs: undefined },
    { timeoutMs: -1 },
    { timeoutMs: 2 ** 32 },
  ]) {
    assert.throws(() => createHttpClient({ ...options, ...override }), isError('configuration'));
  }
});

test('uses injected credentials and headers without adding auth, content type or body serialization', async () => {
  for (const credentials of ['omit', 'same-origin', 'include']) {
    const http = client(
      async (_url, init) => {
        assert.equal(init.credentials, credentials);
        assert.equal(init.headers.get('x-client'), 'host');
        assert.equal(init.headers.get('x-request'), 'request');
        assert.equal(init.headers.get('x-replace'), 'new');
        assert.equal(init.headers.has('authorization'), false);
        assert.equal(init.headers.has('content-type'), false);
        assert.equal(init.headers.has('accept'), false);
        assert.equal(init.body, 'caller-encoded-body');
        return json(true);
      },
      { credentials, headers: { 'X-Client': 'host', 'X-Replace': 'old' } },
    );
    assert.equal(
      await http.request('records', {
        method: 'POST',
        headers: { 'X-Request': 'request', 'x-replace': 'new' },
        body: 'caller-encoded-body',
        decoder: identity,
      }),
      true,
    );
  }
});

test('a previously aborted caller signal prevents the fetch call and does not expose its reason', async () => {
  const controller = new AbortController();
  controller.abort('private abort reason');
  const http = client(async () => assert.fail('fetch must not run'));
  await assert.rejects(
    http.request('records', { signal: controller.signal, decoder: identity }),
    (error) => {
      assert.ok(isError('aborted')(error));
      assert.equal(error.cause, undefined);
      assert.equal(String(error).includes('private'), false);
      return true;
    },
  );
});

test('caller cancellation rejects promptly even if the fetcher ignores cancellation', async () => {
  const controller = new AbortController();
  let requestSignal;
  const http = client(async (_url, init) => {
    requestSignal = init.signal;
    return new Promise(() => {});
  });
  const pending = http.request('records', { signal: controller.signal, decoder: identity });
  controller.abort();
  await assert.rejects(pending, isError('aborted'));
  assert.equal(requestSignal.aborted, true);
});

test(
  'timeout aborts transport and rejects even if the fetcher never settles',
  { timeout: 2000 },
  async () => {
    let requestSignal;
    const http = client(
      async (_url, init) => {
        requestSignal = init.signal;
        return new Promise(() => {});
      },
      { timeoutMs: 10 },
    );
    await assert.rejects(http.request('records', { decoder: identity }), isError('timeout'));
    assert.equal(requestSignal.aborted, true);
  },
);

test('cancellation remains effective while reading a response body', async () => {
  const controller = new AbortController();
  let started;
  const reading = new Promise((resolve) => {
    started = resolve;
  });
  const response = json({ value: 'not returned' });
  response.json = () => {
    started();
    return new Promise(() => {});
  };
  const pending = client(async () => response).request('records', {
    decoder: identity,
    signal: controller.signal,
  });
  await reading;
  controller.abort();
  await assert.rejects(pending, isError('aborted'));
});

test(
  'timeout covers an asynchronous decoder and never returns its late success',
  { timeout: 2000 },
  async () => {
    let release;
    const http = client(async () => json({ value: 1 }), { timeoutMs: 10 });
    const pending = http.request('records', {
      decoder: () =>
        new Promise((resolve) => {
          release = resolve;
        }),
    });
    await assert.rejects(pending, isError('timeout'));
    release('late decoded success');
  },
);

test('completed requests release cancellation forwarding and their timeout', async () => {
  const controller = new AbortController();
  let requestSignal;
  const http = client(
    async (_url, init) => {
      requestSignal = init.signal;
      return json({ complete: true });
    },
    { timeoutMs: 15 },
  );
  await http.request('records', { decoder: identity, signal: controller.signal });
  controller.abort();
  await new Promise((resolve) => setTimeout(resolve, 25));
  assert.equal(requestSignal.aborted, false);
});

test('HTTP failures preserve only status and do not read or retain an error body', async () => {
  const response = new Response('private response body', {
    status: 422,
    headers: { 'content-type': 'text/html' },
  });
  response.json = () => assert.fail('HTTP error bodies must not be decoded');
  await assert.rejects(
    client(async () => response).request('records', { decoder: identity }),
    (error) => {
      assert.ok(isError('http', 422)(error));
      assert.equal(error.cause, undefined);
      assert.equal(JSON.stringify(error).includes('private'), false);
      assert.equal(String(error).includes('private'), false);
      return true;
    },
  );
  assert.equal(response.bodyUsed, false);
});

test('successful HTML fallback is a non-JSON error while structured JSON media types work', async () => {
  await assert.rejects(
    client(
      async () =>
        new Response('<html>private</html>', {
          headers: { 'content-type': 'text/html' },
        }),
    ).request('records', { decoder: identity }),
    isError('non_json', 200),
  );
  const http = client(
    async () =>
      new Response('{"valid":true}', {
        headers: { 'content-type': 'Application/Example+JSON; charset=utf-8' },
      }),
  );
  assert.deepEqual(await http.request('records', { decoder: identity }), { valid: true });
});

test('malformed JSON and a rejected payload decoder have distinct safe errors', async () => {
  await assert.rejects(
    client(
      async () =>
        new Response('{"private":invalid}', {
          headers: { 'content-type': 'application/json' },
        }),
    ).request('records', { decoder: () => assert.fail('decoder must not receive malformed JSON') }),
    isError('malformed_json', 200),
  );
  await assert.rejects(
    client(async () => json({ private: 'secret' })).request('records', {
      decoder: () => {
        throw new Error('private decoder detail');
      },
    }),
    (error) => {
      assert.ok(isError('invalid_payload', 200)(error));
      assert.equal(error.cause, undefined);
      assert.equal(String(error).includes('private'), false);
      return true;
    },
  );
});

test('network errors have no original cause or retry/mock fallback', async () => {
  let calls = 0;
  const http = client(async () => {
    calls += 1;
    throw new Error('private network detail');
  });
  await assert.rejects(http.request('records', { decoder: identity }), (error) => {
    assert.ok(isError('network')(error));
    assert.equal(error.cause, undefined);
    assert.equal(String(error).includes('private'), false);
    return true;
  });
  assert.equal(calls, 1);
});

test('a failed response stream is a network error without exposing its failure details', async () => {
  const response = new Response(
    new ReadableStream({
      start(controller) {
        controller.error(new Error('private stream detail'));
      },
    }),
    { headers: { 'content-type': 'application/json' } },
  );
  await assert.rejects(
    client(async () => response).request('records', { decoder: identity }),
    (error) => {
      assert.ok(isError('network', 200)(error));
      assert.equal(error.cause, undefined);
      assert.equal(String(error).includes('private'), false);
      return true;
    },
  );
});

test('empty HTTP responses still pass through the caller decoder without requiring an envelope', async () => {
  const result = await client(async () => new Response(null, { status: 204 })).request('records', {
    decoder: (payload) => {
      assert.equal(payload, undefined);
      return 'caller-defined result';
    },
  });
  assert.equal(result, 'caller-defined result');
});

test('HTTP error decoder is opt-in and preserves validated structured errors', async () => {
  class Conflict extends HttpClientError {
    constructor(status) {
      super('http', status);
      this.code = 'revision_conflict';
    }
  }
  const http = client(async () =>
    json({ error: { code: 'revision_conflict', message: 'private server detail' } }, 409),
  );
  await assert.rejects(
    http.request('record', {
      decoder: identity,
      errorDecoder: (payload, status) => {
        assert.equal(payload.error.code, 'revision_conflict');
        return new Conflict(status);
      },
    }),
    (error) =>
      error instanceof Conflict && error.status === 409 && !error.message.includes('private'),
  );
});

test('malformed and non-JSON error responses fall back to HTTP metadata without decoding', async () => {
  for (const response of [
    new Response('{bad', { status: 422, headers: { 'content-type': 'application/json' } }),
    new Response('<html>private</html>', { status: 422, headers: { 'content-type': 'text/html' } }),
  ]) {
    let called = false;
    await assert.rejects(
      client(async () => response).request('record', {
        decoder: identity,
        errorDecoder: () => {
          called = true;
          throw new Error('untrusted');
        },
      }),
      isError('http', 422),
    );
    assert.equal(called, false);
  }
});
