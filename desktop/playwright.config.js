// End-to-end checks that start the real Electron app (npm run test:e2e, which builds web/ first).
const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: 'e2e',
  workers: 1,
  timeout: 60000,
});
