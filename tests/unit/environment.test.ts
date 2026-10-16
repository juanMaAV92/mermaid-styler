import { describe, expect, it } from 'vitest';

describe('test environment', () => {
  it('DX: DOMParser and XMLSerializer exist so sanitizer tests are real', () => {
    expect(typeof DOMParser).toBe('function');
    expect(typeof XMLSerializer).toBe('function');
  });
});
