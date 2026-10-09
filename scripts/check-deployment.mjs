import assert from 'node:assert/strict';

const base = new URL(process.argv[2] ?? 'http://127.0.0.1:8080');
const request = (path) => fetch(new URL(path, base), { signal: AbortSignal.timeout(10_000) });
const verifySecurity = (response) => {
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(response.headers.get('x-frame-options'), 'DENY');
  assert.equal(response.headers.get('referrer-policy'), 'no-referrer');
  const csp = response.headers.get('content-security-policy') ?? '';
  for (const directive of ["script-src 'self'", "object-src 'none'", "frame-ancestors 'none'"]) {
    assert.ok(csp.includes(directive), `Missing CSP directive: ${directive}`);
  }
};

const html = await request('/');
assert.equal(html.status, 200);
verifySecurity(html);
assert.equal(html.headers.get('cache-control'), 'no-cache');
const markup = await html.text();
const asset = markup.match(/src="(\/_astro\/[^" ]+\.js)"/)?.[1];
assert.ok(asset, 'Missing built JavaScript entry');
const js = await request(asset);
assert.equal(js.status, 200);
verifySecurity(js);
assert.equal(js.headers.get('cache-control'), 'public, max-age=31536000, immutable');
assert.match(js.headers.get('content-type') ?? '', /javascript/);
const health = await request('/healthz');
assert.equal(health.status, 200);
assert.equal((await health.text()).trim(), 'ok');
for (const path of ['/missing-page', '/_astro/missing.js']) {
  const missing = await request(path);
  assert.equal(missing.status, 404);
  verifySecurity(missing);
}
console.log(`Deployment contract passed for ${base.origin}: HTML, asset, health and 404 headers.`);
