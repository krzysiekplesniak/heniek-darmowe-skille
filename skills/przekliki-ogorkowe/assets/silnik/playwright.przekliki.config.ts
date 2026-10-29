/**
 * Konfiguracja przeklików, osobna od zwykłej konfiguracji e2e: ta suita nie stawia serwera,
 * chodzi po adresie z bazowyUrl() (lokalny serwer, który już działa, albo staging).
 * Kopiujesz do e2e/przekliki/. Uruchomienie (z katalogu repo):
 *   npx playwright test --config e2e/przekliki/playwright.przekliki.config.ts
 */
import { join } from "node:path";
import { defineConfig } from "@playwright/test";
import { bazowyUrl, OPCJE_TELEFONU } from "./_silnik/srodowisko";

export default defineConfig({
  testDir: ".",
  testMatch: /przekliki\.spec\.ts$/,
  fullyParallel: false,
  workers: 1,
  // Zero powtórek: przeklik ma pokazać stan, nie "drugie podejście".
  retries: 0,
  timeout: 8 * 60_000,
  reporter: [
    ["list"],
    ["html", { open: "never", outputFolder: join(import.meta.dirname, "raport", "html") }],
    ["json", { outputFile: join(import.meta.dirname, "raport", "wyniki.json") }]
  ],
  outputDir: join(import.meta.dirname, "artefakty"),
  use: {
    baseURL: bazowyUrl(),
    ...OPCJE_TELEFONU,
    actionTimeout: 20_000,
    navigationTimeout: 60_000,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "off"
  },
  projects: [{ name: "telefon-375x812" }]
});
