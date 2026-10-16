import { registerHooks } from 'node:module';
import js from '@eslint/js';

// typescript-eslint cannot load the TS 7 native package (it needs the JS compiler API,
// supported up to TS 6.0.x; see typescript-eslint#10940). The repo type-checks with
// TS 7 (`typescript`), so resolve typescript-eslint's `require('typescript')` to the
// side-by-side TS 6 install (`typescript6`). Remove once typescript-eslint supports TS 7.
registerHooks({
  resolve(specifier, context, nextResolve) {
    return nextResolve(specifier === 'typescript' ? 'typescript6' : specifier, context);
  },
});

const { default: tseslint } = await import('typescript-eslint');

export default tseslint.config(
  {
    ignores: [
      'dist/',
      '.astro/',
      'node_modules/',
      'playwright-report/',
      'test-results/',
      '.superpowers/',
    ],
  },
  {
    files: ['**/*.ts', '**/*.mjs'],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: "AssignmentExpression[left.property.name='innerHTML']",
          message: 'Insert sanitized nodes with importNode/replaceChildren (AUD-015).',
        },
      ],
    },
  },
);
