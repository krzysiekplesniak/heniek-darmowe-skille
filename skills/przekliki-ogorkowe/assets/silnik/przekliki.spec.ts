/**
 * Generator testów Playwright z plików .feature (przekliki ogórkowe). Kopiujesz do e2e/przekliki/.
 * Dla każdego scenariusza z metką klikaną (domyślnie @jest, @na-galezi; zmienna PRZEKLIKI_METKI)
 * powstaje jeden test, który wykonuje kroki Tła i scenariusza po kolei.
 *
 * Trzy zasady, które odróżniają ten silnik od "zwykłego" BDD:
 *  1. Zdanie bez definicji kroku NIE jest zielone: lokalnie test jest fixme z opisem "BRAK KROKU",
 *     w CI (albo PRZEKLIKI_SCISLE=1) test pada.
 *  2. Po pierwszym błędzie kroki lecą DALEJ (każdy w swoim test.step), test pada na końcu listą wszystkich potknięć.
 *  3. Krok, który rzuci Blokada, kończy scenariusz jako POMINIĘTY z jawnym powodem, nie jako zielony.
 */
import { join } from "node:path";
import { test } from "@playwright/test";
import { wczytajFeatures } from "./_silnik/gherkin.mjs";
import { Blokada, dopasuj, type Swiat } from "./_silnik/rejestr";
import { bazowyUrl, naruszenia, OPCJE_TELEFONU, zabezpieczKontekst } from "./_silnik/srodowisko";

// Każdy plik z definicjami kroków importujesz tutaj (rejestr wypełnia się przy imporcie).
import "./kroki/wspolne";

type Zamykalny = { close: () => Promise<void> };

const METKI = (process.env.PRZEKLIKI_METKI ?? "@jest,@na-galezi").split(",").map((m) => m.trim());
const KATALOG = join(process.cwd(), "e2e", "przekliki");
const BASE = bazowyUrl();

for (const funkcja of wczytajFeatures(KATALOG)) {
  test.describe(`${funkcja.plik} · ${funkcja.nazwa}`, () => {
    for (const scenariusz of funkcja.scenariusze) {
      const tytul = `[${scenariusz.metki.join(" ") || "bez metki"}] ${scenariusz.nazwa}`;
      if (!scenariusz.metki.some((m: string) => METKI.includes(m))) {
        test.skip(tytul, async () => {
          test.info().annotations.push({ type: "nie klikane", description: `metki ${scenariusz.metki.join(" ")}` });
        });
        continue;
      }

      test(tytul, async ({ page, context, browser, request }, testInfo) => {
        naruszenia.length = 0;
        await zabezpieczKontekst(context);
        const dodatkowe: Zamykalny[] = [];
        const swiat: Swiat = {
          page, context, browser, request, baseURL: BASE, testInfo, stan: {},
          dowod: (opis) => testInfo.annotations.push({ type: "dowód", description: opis }),
          nowyTelefon: async () => {
            const ctx = await browser.newContext({ ...OPCJE_TELEFONU, baseURL: BASE });
            await zabezpieczKontekst(ctx);
            dodatkowe.push(ctx);
            return { context: ctx, page: await ctx.newPage() };
          }
        };

        const kroki = [...funkcja.tlo, ...scenariusz.kroki];
        const dopasowania = kroki.map((k) => ({ k, d: dopasuj(k.tekst) }));
        const zle = dopasowania.filter((x) => x.d.rodzaj !== "ok");
        if (zle.length > 0) {
          const opis = zle.map((x) => x.d.rodzaj === "brak"
            ? `BRAK KROKU: ${x.k.slowo} ${x.k.tekst} (${funkcja.plik}:${x.k.linia})`
            : `KROK NIEJEDNOZNACZNY: ${x.k.tekst} -> ${(x.d as { wzorce: string[] }).wzorce.join(" , ")}`).join("\n");
          testInfo.annotations.push({ type: "brak kroku", description: opis });
          if (process.env.CI || process.env.PRZEKLIKI_SCISLE === "1") throw new Error(opis);
          test.fixme(true, opis);
        }

        const bledy: string[] = [];
        let blokada: string | null = null;
        try {
          for (const { k, d } of dopasowania) {
            if (d.rodzaj !== "ok") continue;
            const etykieta = `${k.slowo} ${k.tekst}`;
            try {
              await test.step(etykieta, async () => { await d.def.fn(swiat, ...d.parametry); });
            } catch (error) {
              if (error instanceof Blokada) { blokada = `${etykieta}: ${error.message}`; break; }
              const tresc = error instanceof Error ? error.message : String(error);
              bledy.push(`${etykieta}\n   -> ${tresc.split("\n").slice(0, 6).join("\n   ")}`);
            }
          }
        } finally {
          for (const ctx of dodatkowe) await ctx.close().catch(() => undefined);
        }

        // testInfo.skip musi wyjść poza try/catch, inaczej raport pokaże czerwień zamiast "skipped".
        if (blokada) {
          testInfo.annotations.push({ type: "pominięte (blokada)", description: blokada });
          testInfo.skip(true, blokada);
          return;
        }
        if (naruszenia.length > 0) bledy.push(`PRÓBA WYJŚCIA NA PRODUKCJĘ (zablokowana): ${[...new Set(naruszenia)].join(", ")}`);
        if (bledy.length > 0) throw new Error(`Kroki, które nie przeszły (${bledy.length}/${dopasowania.length}):\n\n${bledy.join("\n\n")}`);
      });
    }
  });
}
