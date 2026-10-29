/**
 * Rejestr kroków przeklików: wzorzec zdania (RegExp, parametry w cudzysłowach jako grupy)
 * -> funkcja dostająca "świat" scenariusza. Kopiujesz do e2e/przekliki/_silnik/.
 */
import type { APIRequestContext, Browser, BrowserContext, Page, TestInfo } from "@playwright/test";

export type Swiat = {
  page: Page;
  context: BrowserContext;
  browser: Browser;
  request: APIRequestContext;
  baseURL: string;
  testInfo: TestInfo;
  /** Stan współdzielony między krokami JEDNEGO scenariusza. */
  stan: Record<string, unknown>;
  /** Dowód do raportu (URL, status, widoczny tekst). Nigdy sekret. */
  dowod: (opis: string) => void;
  /** Drugi "telefon": osobny kontekst przeglądarki z tymi samymi bezpiecznikami. */
  nowyTelefon: () => Promise<{ context: BrowserContext; page: Page }>;
};

export type FunkcjaKroku = (swiat: Swiat, ...parametry: string[]) => Promise<void>;
export type DefinicjaKroku = { wzorzec: RegExp; fn: FunkcjaKroku };

/**
 * Krok, którego NIE DA SIĘ wykonać w tym środowisku (brak skrzynki testowej, brak hasła testowego,
 * 30 minut czekania). To nie jest zielony: scenariusz kończy się jako pominięty z jawnym powodem.
 */
export class Blokada extends Error {
  constructor(powod: string) {
    super(`BLOKADA: ${powod}`);
    this.name = "Blokada";
  }
}

const rejestr: DefinicjaKroku[] = [];

export function krok(wzorzec: RegExp, fn: FunkcjaKroku): void {
  rejestr.push({ wzorzec, fn });
}

export type Dopasowanie =
  | { rodzaj: "ok"; def: DefinicjaKroku; parametry: string[] }
  | { rodzaj: "brak" }
  | { rodzaj: "niejednoznaczny"; wzorce: string[] };

/** Zdanie musi pasować do DOKŁADNIE jednej definicji: zero = brak kroku, dwie = niejednoznaczność (oba to błąd). */
export function dopasuj(tekst: string): Dopasowanie {
  const trafienia = rejestr
    .map((def) => ({ def, m: tekst.match(def.wzorzec) }))
    .filter((t): t is { def: DefinicjaKroku; m: RegExpMatchArray } => t.m !== null);
  if (trafienia.length === 0) return { rodzaj: "brak" };
  if (trafienia.length > 1) return { rodzaj: "niejednoznaczny", wzorce: trafienia.map((t) => String(t.def.wzorzec)) };
  return { rodzaj: "ok", def: trafienia[0].def, parametry: trafienia[0].m.slice(1) };
}
