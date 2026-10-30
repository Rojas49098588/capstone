// Unit tests for the pure main-process and preload modules. The Electron end-to-end checks in e2e/
// run with Playwright instead (npm run test:e2e).
const { defineConfig } = require('vitest/config');

module.exports = defineConfig({
  test: {
    include: ['test/**/*.test.js'],
    environment: 'node',
  },
});
