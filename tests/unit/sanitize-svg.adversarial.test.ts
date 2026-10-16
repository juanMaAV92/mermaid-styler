import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { sanitizeSvg } from '../../src/lib/mermaid/sanitize-svg';
import { adversarialFixtures } from '../fixtures/adversarial';
import type { AdversarialFixture } from '../fixtures/adversarial';

const fixturesDir = resolve(dirname(fileURLToPath(import.meta.url)), '../fixtures/adversarial');
const svgFixtures = adversarialFixtures.filter((fixture) => fixture.kind === 'svg');

const check = (fixture: AdversarialFixture) => {
  const source = readFileSync(resolve(fixturesDir, fixture.file), 'utf8');
  const output = sanitizeSvg(source);
  fixture.mustContain.forEach((text) => expect(output).toContain(text));
  fixture.mustNotContain.forEach((text) => expect(output).not.toContain(text));
};

describe('sanitizeSvg adversarial fixtures', () => {
  // `pending` fixtures document known gaps: they must keep failing until fixed.
  for (const fixture of svgFixtures) {
    const runner = fixture.pending ? it.fails : it;
    runner(`${fixture.id}: sanitized output excludes payload`, () => check(fixture));
  }
});
