const nextConfig = require('eslint-config-next');
const globals = require('globals');

module.exports = [
  ...nextConfig,
  {
    files: ['tests/**/*.{ts,tsx}'],
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.jest,
      },
    },
    rules: {
      '@next/next/no-html-link-for-pages': 'off',
      '@next/next/no-server-import-in-page': 'off',
    },
  },
];
