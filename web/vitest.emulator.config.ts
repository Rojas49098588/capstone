import { defineConfig } from 'vitest/config';

// Integration tests of the Firebase adapters against the local emulators: `npm run test:emulator`.
export default defineConfig({
  test: { include: ['src/sync/*.emulator.test.ts'], testTimeout: 30000, hookTimeout: 30000 },
});
