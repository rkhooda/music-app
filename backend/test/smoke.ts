/**
 * In-process smoke check for the playback pipeline (needs network + `npm run setup`).
 *   npm test
 * Verifies: in-flight dedup, priority ordering, and transparent re-extraction when
 * YouTube answers 403 for a stale URL.
 */
import assert from 'assert';

process.env.PORT = process.env.PORT || '3999';
const port = process.env.PORT;

// Poison the first googlevideo fetch so /stream must re-extract and retry.
const realFetch = globalThis.fetch;
let poisonRemaining = 1;
let upstreamCalls = 0;
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  if (url.includes('googlevideo.com')) {
    upstreamCalls += 1;
    if (poisonRemaining > 0) {
      poisonRemaining -= 1;
      return new Response('expired', { status: 403 });
    }
  }
  return realFetch(input, init);
}) as typeof fetch;

// eslint-disable-next-line @typescript-eslint/no-var-requires
require('../src/server');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { getStream, streamCacheStats } = require('../src/services/streamService');

const main = async () => {
  await new Promise((resolve) => setTimeout(resolve, 1000));

  // 1. Dedup: three callers, one extraction.
  const id = 'hTWKbfoikeg';
  const before = streamCacheStats().extractions;
  const [a, b, c] = await Promise.all([getStream(id, 'warm'), getStream(id, 'play'), getStream(id, 'play')]);
  assert.strictEqual(a.url, b.url);
  assert.strictEqual(b.url, c.url);
  assert.strictEqual(streamCacheStats().extractions - before, 1, 'expected exactly one extraction');
  console.log('PASS dedup');

  // 2. Expired URL recovery via the HTTP proxy.
  const res = await realFetch(`http://localhost:${port}/api/music/stream/${id}`, { headers: { Range: 'bytes=0-1023' } });
  const bytes = (await res.arrayBuffer()).byteLength;
  assert.strictEqual(res.status, 206, `expected 206, got ${res.status}`);
  assert.strictEqual(bytes, 1024);
  assert.strictEqual(upstreamCalls, 2, 'expected one 403 then one successful upstream fetch');
  console.log('PASS expired-url recovery');

  // 3. Priority: the first two warm jobs take both slots immediately; the play request
  //    must then dequeue before the remaining warm jobs, so it always finishes before the last one.
  const warmIds = ['YQHsXMglC9A', '09R8_2nJtjg', 'kJQP7kiw5Fk', 'RgKAFK5djSk'];
  const order: string[] = [];
  const track = (vid: string, p: 'play' | 'warm') => getStream(vid, p).then(() => order.push(vid));
  const warm = warmIds.map((vid) => track(vid, 'warm'));
  const play = track('JGwWNGJdvx8', 'play');
  await Promise.all([...warm, play]);
  const playIndex = order.indexOf('JGwWNGJdvx8');
  const lastWarmIndex = order.indexOf(warmIds[warmIds.length - 1]);
  assert.ok(playIndex < lastWarmIndex, `play finished #${playIndex + 1} but the last queued warm job finished #${lastWarmIndex + 1}`);
  console.log(`PASS priority (play finished #${playIndex + 1} of ${order.length}, last warm #${lastWarmIndex + 1})`);

  console.log('SMOKE OK', JSON.stringify(streamCacheStats()));
  process.kill(process.pid, 'SIGINT');
};

main().catch((error) => {
  console.error('SMOKE FAILED', error);
  process.exit(1);
});
