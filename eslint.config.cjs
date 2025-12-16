const js = require('@eslint/js')
const tseslint = require('typescript-eslint')
const next = require('@next/eslint-plugin-next')

module.exports = [
  { ignores: ['.next/**', 'node_modules/**', 'dist/**', 'coverage/**'] },

  js.configs.recommended,

  ...tseslint.configs.recommended.map((c) => ({
    ...c,
    rules: {
      ...(c.rules || {}),
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      '@typescript-eslint/ban-ts-comment': 'off',
      '@typescript-eslint/no-require-imports': 'off',
    },
  })),

  {
    files: ['**/*.{js,jsx,ts,tsx}'],
    plugins: { '@next/next': next },
    rules: {
      ...next.configs['core-web-vitals'].rules,
      'prefer-const': 'off',
      'no-useless-escape': 'off',
      'no-case-declarations': 'off',
    },
  },

  {
    files: ['**/*.cjs', '**/*.js'],
    languageOptions: {
      globals: {
        module: 'readonly',
        require: 'readonly',
        process: 'readonly',
        __dirname: 'readonly',
        console: 'readonly',
        fetch: 'readonly',
        window: 'readonly',
      },
    },
    rules: {
      'no-undef': 'off',
    },
  },
]
