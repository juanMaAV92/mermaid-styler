export type AdversarialFixture = {
  id: string;
  file: string;
  kind: 'svg' | 'mermaid';
  audit: 'AUD-003' | 'AUD-013' | 'AUD-015' | 'AUD-016' | 'AUD-017' | 'AUD-021';
  mustNotContain: string[];
  mustContain: string[];
  pending?: boolean;
};

// `pending: true` marks vectors the sanitizer does not handle yet. The unit
// test runs them with `it.fails`; remove the flag when the fix lands.
// Mermaid fixtures (`kind: 'mermaid'`) are consumed by E2E tests only.
export const adversarialFixtures: AdversarialFixture[] = [
  { id: 'css-import-string', file: 'svg/css-import-string.svg', kind: 'svg', audit: 'AUD-013', mustNotContain: ['evil.example'], mustContain: ['safe-css-import'] },
  { id: 'css-image-set', file: 'svg/css-image-set.svg', kind: 'svg', audit: 'AUD-013', mustNotContain: ['evil.example'], mustContain: ['safe-image-set'] },
  { id: 'css-url-external', file: 'svg/css-url-external.svg', kind: 'svg', audit: 'AUD-003', mustNotContain: ['evil.example'], mustContain: ['safe-url-external'] },
  { id: 'foreignobject-img-unclosed', file: 'svg/foreignobject-img-unclosed.svg', kind: 'svg', audit: 'AUD-017', mustNotContain: ['evil.example', '<img'], mustContain: ['safe-foreign-img', '>ok<'] },
  { id: 'void-hr-unclosed', file: 'svg/void-hr-unclosed.svg', kind: 'svg', audit: 'AUD-017', mustNotContain: [], mustContain: ['safe-void-hr', 'after-hr', '<hr'] },
  { id: 'use-external-href', file: 'svg/use-external-href.svg', kind: 'svg', audit: 'AUD-003', mustNotContain: ['evil.example', '<use'], mustContain: ['safe-use'] },
  { id: 'event-handler-attr', file: 'svg/event-handler-attr.svg', kind: 'svg', audit: 'AUD-003', mustNotContain: ['onclick', 'alert(1)'], mustContain: ['safe-event'] },
  { id: 'animate-set-href', file: 'svg/animate-set-href.svg', kind: 'svg', audit: 'AUD-015', mustNotContain: ['javascript:', '<set'], mustContain: ['safe-animate'] },
  { id: 'themecss-image-set', file: 'mermaid/themecss-image-set.mmd', kind: 'mermaid', audit: 'AUD-013', mustNotContain: ['evil.example'], mustContain: [] },
  { id: 'edges-501', file: 'mermaid/edges-501.mmd', kind: 'mermaid', audit: 'AUD-016', mustNotContain: [], mustContain: [] },
  { id: 'init-primary-red', file: 'mermaid/init-primary-red.mmd', kind: 'mermaid', audit: 'AUD-021', mustNotContain: [], mustContain: [] },
];
