import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { sanitizeSvg } from '../../src/lib/mermaid/sanitize-svg';
import { MermaidRenderError } from '../../src/lib/mermaid/types';
import { adversarialFixtures } from '../fixtures/adversarial';
import type { AdversarialFixture } from '../fixtures/adversarial';

const fixturesDir = resolve(dirname(fileURLToPath(import.meta.url)), '../fixtures/adversarial');
const svgFixtures = adversarialFixtures.filter((fixture) => fixture.kind === 'svg');

// Fixtures are loaded outside `it.fails` so a missing file can never make a
// pending test pass vacuously.
const sources = new Map<string, string>(
  svgFixtures.map((fixture) => {
    const path = resolve(fixturesDir, fixture.file);
    return [fixture.id, existsSync(path) ? readFileSync(path, 'utf8') : ''] as [string, string];
  }),
);

describe('adversarial fixture manifest', () => {
  it.each(adversarialFixtures.map((fixture) => [fixture.id, fixture.file] as [string, string]))(
    '%s: fixture file exists and is non-empty',
    (_id, file) => {
      const path = resolve(fixturesDir, file);
      expect(existsSync(path)).toBe(true);
      expect(statSync(path).size).toBeGreaterThan(0);
    },
  );

  it('lists every fixture file on disk', () => {
    const onDisk = ['svg', 'mermaid'].flatMap((dir) => readdirSync(resolve(fixturesDir, dir)).filter((name) => !name.startsWith('.')).map((name) => `${dir}/${name}`));
    expect(onDisk.sort()).toEqual(adversarialFixtures.map((fixture) => fixture.file).sort());
  });
});

const assertSanitized = (fixture: AdversarialFixture, source: string, pending: boolean) => {
  let output: string;
  try {
    output = sanitizeSvg(source);
  } catch (error) {
    const expected = error instanceof MermaidRenderError && error.code === 'SANITIZE_ERROR';
    if (expected) throw error;
    // Unexpected error kind: `it.fails` only passes when the body throws, so
    // returning normally makes a pending test fail for real. Non-pending
    // tests simply propagate the error.
    if (pending) return;
    throw error;
  }
  fixture.mustContain.forEach((text) => expect(output).toContain(text));
  fixture.mustNotContain.forEach((text) => expect(output).not.toContain(text));
};

describe('sanitizeSvg adversarial fixtures', () => {
  for (const fixture of svgFixtures) {
    const source = sources.get(fixture.id) ?? '';
    const name = `${fixture.id}: sanitized output excludes payload`;
    if (fixture.pending) {
      it.fails(name, () => assertSanitized(fixture, source, true));
    } else {
      it(name, () => assertSanitized(fixture, source, false));
    }
  }
});
