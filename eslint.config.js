// @ts-check
const js = require('@eslint/js');
const tseslint = require('typescript-eslint');
const react = require('eslint-plugin-react');
const reactHooks = require('eslint-plugin-react-hooks');
const prettierConfig = require('eslint-config-prettier');

module.exports = tseslint.config(
  {
    // Root tooling scripts (this file, webpack.config.js, ...) are plain Node
    // CommonJS, not application code — no need to lint them, and doing so
    // would need a whole separate Node-globals/no-require-imports carve-out
    // just for these couple of files.
    ignores: ['dist/**', 'node_modules/**', '*.config.js']
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    ...js.configs.recommended
  },
  ...tseslint.configs.recommended.map(config => ({
    ...config,
    files: ['src/**/*.{ts,tsx}']
  })),
  {
    files: ['src/**/*.{ts,tsx}'],
    plugins: {
      react,
      'react-hooks': reactHooks
    },
    languageOptions: {
      ecmaVersion: 2021,
      sourceType: 'module',
      parserOptions: {
        ecmaFeatures: { jsx: true }
      },
      globals: {
        window: 'readonly',
        document: 'readonly',
        console: 'readonly',
        fetch: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        requestAnimationFrame: 'readonly',
        cancelAnimationFrame: 'readonly',
        AbortController: 'readonly',
        CustomEvent: 'readonly',
        HTMLScriptElement: 'readonly',
        DOMStringMap: 'readonly',
        Blob: 'readonly',
        URL: 'readonly'
      }
    },
    settings: {
      react: { pragma: 'h', version: '18.3' }
    },
    rules: {
      ...react.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      // Preact/JSX via `h` — no React import needed, and no runtime React.PropTypes.
      'react/react-in-jsx-scope': 'off',
      'react/prop-types': 'off',
      // Preact JSX genuinely supports `class`/`for`/raw SVG attrs like
      // `stroke-width` (unlike React, which requires className/htmlFor/
      // camelCase) — this codebase uses that deliberately throughout, it's
      // not a mistake to "fix" by rewriting hundreds of call sites.
      'react/no-unknown-property': 'off',
      // The codebase's copy is French and uses plain apostrophes in JSX text
      // constantly (l'utilisateur, d'un menu, ...) — escaping them all would
      // be pure churn for zero real benefit.
      'react/no-unescaped-entities': 'off',
      // The codebase deliberately reads live store state inside callbacks
      // (useShopperStore.getState()) instead of always listing every field in
      // deps — several hooks already carry a deliberate eslint-disable for
      // this exact pattern, so keep it a warning, not a hard error.
      'react-hooks/exhaustive-deps': 'warn',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'warn'
    }
  },
  prettierConfig
);
