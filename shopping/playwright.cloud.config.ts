import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/cloud-browser",
  workers: 1,
  use: {
    baseURL: "http://127.0.0.1:3014",
    viewport: { width: 390, height: 844 },
    launchOptions: {
      executablePath: "/usr/bin/chromium",
      args: ["--no-sandbox"],
    },
    trace: "retain-on-failure",
  },
  webServer: {
    command: "python3 -m http.server 3014 --directory out --bind 127.0.0.1",
    url: "http://127.0.0.1:3014",
    reuseExistingServer: false,
  },
});
