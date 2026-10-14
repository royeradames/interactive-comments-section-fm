import { defineConfig } from "@playwright/test";

const port = Number(process.env.PORT ?? 19202);

export default defineConfig({
  testDir: "./tests",
  workers: 2,
  reporter: "list",
  use: { baseURL: `http://127.0.0.1:${port}`, headless: true, channel: "chrome" },
  webServer: {
    command: `npm run start -- --hostname 127.0.0.1 --port ${port}`,
    url: `http://127.0.0.1:${port}`,
    reuseExistingServer: false,
  },
});
