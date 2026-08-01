// @ts-check
const { defineConfig, devices } = require('@playwright/test');

// Deliberately NOT the dev port (8000, see `npm run dev`). The webServer block
// below starts its own throwaway `serve` on this port, so tests never collide
// with — or silently test against — a dev server you left running. Override
// with PW_PORT if 3456 is taken.
const PORT = process.env.PW_PORT || 3456;

module.exports = defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: `npx serve . -l ${PORT} --no-clipboard`,
    port: Number(PORT),
    cwd: __dirname,
    reuseExistingServer: !process.env.CI,
  },
});
