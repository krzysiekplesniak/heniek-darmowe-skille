/**
 * Środowisko przeklików: lokalnie albo staging, NIGDY produkcja. Kopiujesz do e2e/przekliki/_silnik/.
 *
 * Dwa twarde bezpieczniki (rzucają, nie ostrzegają):
 *   1. baseURL nie może być hostem produkcji (lista: srodowiska.produkcja_hosty w .claude/projekt-heniek.json
 *      plus zmienna PRZEKLIKI_ZAKAZANE_HOSTY, hosty po przecinku).
 *   2. Każde żądanie przeglądarki do hosta produkcji jest przerywane (route.abort) i zapisywane jako naruszenie;
 *      scenariusz z naruszeniem pada na końcu.
 * Sekrety (hasło testowe, tokeny) czytasz ze zmiennych środowiska i nigdy nie wpisujesz do dowodów ani URL-i.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { BrowserContext, BrowserContextOptions } from "@playwright/test";

type Projekt = { srodowiska?: { lokalne?: string; staging?: string; produkcja_hosty?: string[] } };

function projekt(): Projekt {
  const plik = join(process.cwd(), ".claude", "projekt-heniek.json");
  if (!existsSync(plik)) return {};
  return JSON.parse(readFileSync(plik, "utf8").replace(/^﻿/, "")) as Projekt;
}

export function hostyProdukcji(): string[] {
  const zPliku = projekt().srodowiska?.produkcja_hosty ?? [];
  const zEnv = (process.env.PRZEKLIKI_ZAKAZANE_HOSTY ?? "").split(",").map((h) => h.trim()).filter(Boolean);
  return [...new Set([...zPliku, ...zEnv].map((h) => h.toLowerCase()))];
}

function toProdukcja(host: string): boolean {
  const h = host.toLowerCase();
  return hostyProdukcji().some((p) => h === p || h.endsWith(`.${p}`));
}

export function bazowyUrl(): string {
  const s = projekt().srodowiska ?? {};
  const url = (process.env.PRZEKLIKI_BASE_URL ?? s.staging ?? s.lokalne ?? "http://localhost:3000").replace(/\/$/, "");
  const host = new URL(url).hostname;
  if (toProdukcja(host)) throw new Error(`PRZEKLIKI: baseURL ${host} to PRODUKCJA. Przekliki tylko lokalnie albo na stagingu.`);
  return url;
}

export const OPCJE_TELEFONU: BrowserContextOptions = {
  viewport: { width: 375, height: 812 },
  isMobile: true,
  hasTouch: true,
  deviceScaleFactor: 2,
  locale: process.env.PRZEKLIKI_JEZYK ?? "pl-PL"
};

/** Naruszenia z bieżącego scenariusza (zerowane przez spec przed każdym scenariuszem). */
export const naruszenia: string[] = [];

export async function zabezpieczKontekst(context: BrowserContext): Promise<void> {
  await context.route("**/*", async (route) => {
    const host = new URL(route.request().url()).hostname;
    if (toProdukcja(host)) {
      naruszenia.push(host);
      await route.abort("blockedbyclient");
      return;
    }
    await route.continue();
  });
}
