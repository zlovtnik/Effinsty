module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module'
  },
  extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended', 'prettier'],
  env: {
    browser: true,
    es2022: true,
    node: true
  },
  rules: {
    'no-restricted-globals': [
      'error',
      {
        name: 'localStorage',
        message: 'Browser storage is forbidden for session/token persistence. Use in-memory state only.'
      },
      {
        name: 'sessionStorage',
        message: 'Browser storage is forbidden for session/token persistence. Use in-memory state only.'
      }
    ],
    'no-restricted-properties': [
      'error',
      {
        object: 'window',
        property: 'localStorage',
        message: 'Browser storage is forbidden for session/token persistence. Use in-memory state only.'
      },
      {
        object: 'window',
        property: 'sessionStorage',
        message: 'Browser storage is forbidden for session/token persistence. Use in-memory state only.'
      },
      {
        object: 'globalThis',
        property: 'localStorage',
        message: 'Browser storage is forbidden for session/token persistence. Use in-memory state only.'
      },
      {
        object: 'globalThis',
        property: 'sessionStorage',
        message: 'Browser storage is forbidden for session/token persistence. Use in-memory state only.'
      }
    ]
  },
  overrides: [
    {
      files: ['**/*.svelte'],
      parser: 'svelte-eslint-parser',
      parserOptions: {
        parser: '@typescript-eslint/parser',
        ecmaVersion: 'latest',
        sourceType: 'module',
        extraFileExtensions: ['.svelte']
      },
      plugins: ['svelte'],
      rules: {
        'no-inner-declarations': 'off',
        'svelte/no-at-html-tags': 'error'
      }
    }
  ]
};
