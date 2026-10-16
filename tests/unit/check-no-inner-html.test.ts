import { describe, expect, it } from 'vitest';
import { findInnerHtmlAssignments } from '../../scripts/check-no-inner-html.mjs';

const find = (text: string) =>
  findInnerHtmlAssignments(text, 'x.ts') as { file: string; line: number }[];

describe('check-no-inner-html', () => {
  it('AUD-015: flags innerHTML assignment and +=', () => {
    expect(find('el.innerHTML = x;')).toEqual([{ file: 'x.ts', line: 1 }]);
    expect(find('a;\nel.innerHTML += x;')).toEqual([{ file: 'x.ts', line: 2 }]);
  });

  it('AUD-015: ignores comparisons and reads', () => {
    expect(find('if (a.innerHTML === b) {}')).toEqual([]);
    expect(find('if (a.innerHTML == b) {}')).toEqual([]);
    expect(find('const s = el.innerHTML;')).toEqual([]);
  });

  it('AUD-015: respects the allow comment on the previous line only', () => {
    expect(find('// lint-allow-inner-html -- legacy\nel.innerHTML = x;')).toEqual([]);
    expect(find('// lint-allow-inner-html -- legacy\n\nel.innerHTML = x;')).toEqual([
      { file: 'x.ts', line: 3 },
    ]);
    expect(find('// lint-allow-inner-html\nel.innerHTML = x;')).toHaveLength(1);
  });
});
