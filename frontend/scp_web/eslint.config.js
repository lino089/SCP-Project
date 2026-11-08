import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    rules: {
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/preserve-manual-memoization': 'warn',
      'no-restricted-syntax': [
        'error',
        {
          selector: "MemberExpression[property.name='data'][object.property.name='data']",
          message: "Akses .data.data dilarang (P-9). Gunakan unwrap() atau unwrapList() dari utils/responseHelper.",
        },
        {
          selector: "MemberExpression[property.name='success'][object.property.name='data']",
          message: "Akses .data.success dilarang (P-9). Axios interceptor mengembalikan envelope langsung; gunakan res.success atau unwrap().",
        },
      ],
    },
  },
])
