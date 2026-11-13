#!/usr/bin/env node
/**
 * cr-zakresy.mjs — co poddać recenzji (menu kandydatów), jak dużo kodu jest objęte
 * recenzją (`--pokrycie`) i raport POKRYCIE-CR.md (`--zapisz`).
 *
 * Kanonem jest ten plik w pluginie. Moduły pomocnicze
 * (parser argumentów, logika rejestrów i pokrycia) są tu zwinięte do jednego pliku, bo skill
 * nie ma osobnego katalogu z bibliotekami. Wszystko, co zależy od
 * układu katalogów, idzie do konfiguracji — NIC nie jest zaszyte w kodzie.
 *
 * KONFIGURACJA: `.claude/projekt-heniek.json` w katalogu projektu (flaga `--config=<plik>`
 * nadpisuje). Czytane klucze:
 *   cr.rejestr_cr            ścieżka REJESTR-CR (BRAK domyślnej: bez niej kod 2)
 *   cr.rejestr_znalezisk     ścieżka REJESTR-ZNALEZISK (BRAK domyślnej: bez niej kod 2)
 *   cr.katalogi_zrodel       prefiksy katalogów kodu do pokrycia (BRAK domyślnej: bez niej kod 2)
 *   cr.baza_galezi           refy integracyjne [staging, produkcja, ...] (BRAK domyślnej: bez niej kod 2)
 *   cr.wyjatki.nie_kod       globy, które NIE są kodem do recenzji (domyślnie docs, .claude, releases, *.md)
 *   cr.wyjatki.ryzyko        [{ "znak": "...", "wzor": "regex" }] — znaczniki ryzyka do sortowania menu (domyślnie brak)
 *   cr.wyjatki.pieniadze_tozsamosc  globy sekcji „pieniądze i tożsamość” raportu (domyślnie: pliki ścieżek,
 *                            których `kategoria` pasuje do pieniądz/tożsam/dostęp)
 *   cr.obszary_glebokie      katalogi, które dzielimy głębiej w menu, np. ["app/features/"] (domyślnie brak)
 *   sciezki (klucz główny)   ścieżki krytyczne: [{ id, nazwa, kategoria?, pliki: [glob] }]; ID P1..Pn lub dowolne
 *   nie_sciezki (klucz główny) — NIE jest czytany; wykluczenia z pokrycia idą wyłącznie przez cr.wyjatki.nie_kod
 * Nieznany klucz w `cr` = błąd konfiguracji (kod 2), żeby literówka nie zmieniła wyniku po cichu.
 *
 * DWA TRYBY:
 *
 * 1. MENU (domyślny) — kandydaci do CR z okna czasu: gałęzie, epiki, obszary, z rozmiarem,
 *    osiągalnością, znacznikami ryzyka i statusem z rejestrów. Nie drukuje ani jednej linii diffa.
 *      node scripts/cr-zakresy.mjs --dni=7
 *      node scripts/cr-zakresy.mjs --dzien=2026-09-18
 *      node scripts/cr-zakresy.mjs --od=2026-09-15 --do=2026-09-21 [--json]
 *
 * 2. POKRYCIE (`--pokrycie`) — dla każdego pliku z `cr.katalogi_zrodel` (bez testów): data ostatniej
 *    zmiany vs data ostatniego CR, który go obejmował (REJESTR-CR + sekcje `## Fala` w REJESTR-ZNALEZISK).
 *    Status NIGDY / NIEAKTUALNY / AKTUALNY + podsumowanie per domena.
 *      node scripts/cr-zakresy.mjs --pokrycie
 *      node scripts/cr-zakresy.mjs --pokrycie --sciezka=<prefiks-katalogu>/
 *      node scripts/cr-zakresy.mjs --pokrycie --sciezka=<id-sciezki> --status=NIGDY,NIEAKTUALNY --json   # ścieżka krytyczna
 *      node scripts/cr-zakresy.mjs --pokrycie --zakres=origin/main...HEAD --status=NIGDY,NIEAKTUALNY
 *      node scripts/cr-zakresy.mjs --pokrycie --zapisz=POKRYCIE-CR.md [--sucho]
 *    Wiersz REJESTR-CR z odsyłaczem `cr-pliki/<data>-<id>.txt` (kolumna Pliki) = jawna lista plików
 *    zrecenzowanych tego dnia (zastępuje wyprowadzanie z gałęzi). Skróty ścieżek w rejestrach
 *    (`checkout/route.ts`) liczą się, gdy sufiks jest jednoznaczny.
 *    Wiersze typu `audyt` i fale `AUDYT…` raport liczy osobno („CR" vs „recenzja kodu").
 *
 * ZAPIS: skrypt NIE pisze nigdzie poza plikiem podanym w `--zapisz=`. `--sucho` z `--zapisz=`
 * liczy wszystko, wypisuje podsumowanie i NIE tworzy pliku.
 *
 * STANY ZNALEZISK (bramka `cr-bramka-zamkniecia.mjs`): kanon = ten słownik w pluginie:
 *   NAPRAWIONE | OBALONE | CZYSTO | PYTANIE Qn.
 *   `POTWIERDZONE` świadomie nie istnieje (decyzja właściciela).
 *
 * Kody wyjścia: 0 = raport wypisany / zapisany; 1 = naruszenie (używa go bramka, nie menu);
 * 2 = błąd użycia, błąd konfiguracji, brak refu albo rejestr, którego nie da się przeczytać
 * (fail-closed: nic nie wypisane jako wynik).
 */
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

// ───────────────────────── błędy (wszystkie → kod 2) ─────────────────────────

export class BladRejestru extends Error {
  constructor(komunikat) {
    super(komunikat);
    this.name = "BladRejestru";
  }
}

export class BladUzycia extends Error {
  constructor(komunikat) {
    super(komunikat);
    this.name = "BladUzycia";
  }
}

export class BladKonfiguracji extends Error {
  constructor(komunikat) {
    super(komunikat);
    this.name = "BladKonfiguracji";
  }
}

// ───────────────────────── argumenty ─────────────────────────

/**
 * Parser flag `--nazwa`, `--nazwa=wartość` i `--nazwa wartość` (dla flag z wartością).
 * Nieznana flaga trafia do `nieznane` — wywołujący zwraca wtedy kod 2.
 */
export function sparsujArgumenty(argv, spec) {
  const znane = new Map(spec.flagi.map((f) => [f.nazwa, f]));
  const wartosci = new Map();
  const nieznane = [];
  let pomoc = false;
  for (let i = 0; i < argv.length; i++) {
    const t = argv[i];
    if (t === "--help" || t === "-h") {
      pomoc = true;
      continue;
    }
    if (!t.startsWith("--")) {
      nieznane.push(t);
      continue;
    }
    const rownosc = t.indexOf("=");
    const nazwa = rownosc >= 0 ? t.slice(2, rownosc) : t.slice(2);
    const flaga = znane.get(nazwa);
    if (!flaga) {
      nieznane.push(t);
      continue;
    }
    if (flaga.wartosc) {
      if (rownosc >= 0) wartosci.set(nazwa, t.slice(rownosc + 1));
      else if (i + 1 < argv.length && !argv[i + 1].startsWith("--")) wartosci.set(nazwa, argv[++i]);
      else wartosci.set(nazwa, "");
    } else {
      if (rownosc >= 0) nieznane.push(t);
      else wartosci.set(nazwa, true);
    }
  }
  return {
    pomoc,
    nieznane,
    ma: (n) => wartosci.has(n),
    wartosc: (n, domyslna) => (wartosci.has(n) ? wartosci.get(n) : domyslna)
  };
}

export function tekstPomocy(spec) {
  const linie = [spec.opis, "", "Użycie:"];
  for (const u of spec.uzycie) linie.push("  " + u);
  linie.push("", "Flagi:");
  for (const f of spec.flagi) linie.push(`  --${f.nazwa}${f.wartosc ? "=<wartość>" : ""}  ${f.opis}`);
  linie.push("", "Konfiguracja: .claude/projekt-heniek.json (klucz cr; --config=<plik> nadpisuje).");
  return linie.join("\n");
}

// ───────────────────────── konfiguracja ─────────────────────────

const KLUCZE_CR = ["rejestr_cr", "rejestr_znalezisk", "katalogi_zrodel", "baza_galezi", "wyjatki", "obszary_glebokie"];
const KLUCZE_WYJATKOW = ["nie_kod", "ryzyko", "pieniadze_tozsamosc"];

/**
 * Wartości domyślne NEUTRALNE: nie ma w nich układu żadnego repo. Klucze bez domyślnej (`null`
 * albo pusta lista) muszą być podane w konfiguracji — `wymagane()` zwraca wtedy kod 2.
 */
export function domyslneCr() {
  return {
    rejestr_cr: null,
    rejestr_znalezisk: null,
    katalogi_zrodel: [],
    baza_galezi: [],
    wyjatki: { nie_kod: ["docs/**", ".claude/**", "releases/**", "**/*.md"], ryzyko: [], pieniadze_tozsamosc: null },
    obszary_glebokie: []
  };
}

/** Klucz `cr` bez wartości = BladKonfiguracji (kod 2): bez konfiguracji nie ma wyniku, nie ma zgadywania. */
export function wymagane(v, nazwa) {
  const pusta = v === null || v === undefined || v === "" || (Array.isArray(v) && v.length === 0);
  if (pusta) throw new BladKonfiguracji(`brak konfiguracji cr.${nazwa} — ustaw ją w .claude/projekt-heniek.json (kod 2, bez niej nie ma wyniku)`);
  return v;
}

function tekstNiepusty(v, nazwa) {
  if (typeof v !== "string" || !v.trim()) throw new BladKonfiguracji(`${nazwa}: oczekiwany niepusty tekst`);
  return v.trim();
}

function tablicaTekstow(v, nazwa) {
  if (!Array.isArray(v) || v.some((x) => typeof x !== "string" || !x.trim())) {
    throw new BladKonfiguracji(`${nazwa}: oczekiwana tablica niepustych tekstów`);
  }
  return v.map((x) => x.trim());
}

function obiekt(v, nazwa) {
  if (typeof v !== "object" || v === null || Array.isArray(v)) throw new BladKonfiguracji(`${nazwa}: oczekiwany obiekt`);
  return v;
}

/**
 * Wczytuje konfigurację. Brak pliku domyślnego = wartości domyślne (rejestry tam, gdzie
 * wskazują domyślne ścieżki; jeśli ich nie ma, błąd przyjdzie później jako BladRejestru).
 * Brak pliku wskazanego jawnie (`jawny`) = błąd konfiguracji.
 */
export function wczytajKonfig(plik, jawny) {
  if (!existsSync(plik)) {
    if (jawny) throw new BladKonfiguracji(`brak pliku konfiguracji ${plik}`);
    return { cr: domyslneCr(), sciezki: [], zrodlo: null };
  }
  let j;
  try {
    j = JSON.parse(readFileSync(plik, "utf8"));
  } catch (e) {
    throw new BladKonfiguracji(`${plik}: nie jest poprawnym JSON (${e.message.split(/\r?\n/)[0]})`);
  }
  obiekt(j, plik);
  const cr = domyslneCr();
  const s = j.cr === undefined ? {} : obiekt(j.cr, "cr");
  for (const k of Object.keys(s)) {
    if (!KLUCZE_CR.includes(k)) throw new BladKonfiguracji(`cr.${k}: nieznany klucz (dozwolone: ${KLUCZE_CR.join(", ")})`);
  }
  if (s.rejestr_cr !== undefined) cr.rejestr_cr = tekstNiepusty(s.rejestr_cr, "cr.rejestr_cr");
  if (s.rejestr_znalezisk !== undefined) cr.rejestr_znalezisk = tekstNiepusty(s.rejestr_znalezisk, "cr.rejestr_znalezisk");
  if (s.katalogi_zrodel !== undefined) cr.katalogi_zrodel = tablicaTekstow(s.katalogi_zrodel, "cr.katalogi_zrodel");
  if (s.baza_galezi !== undefined) {
    cr.baza_galezi = tablicaTekstow(s.baza_galezi, "cr.baza_galezi");
    if (cr.baza_galezi.length === 0) throw new BladKonfiguracji("cr.baza_galezi: pusta lista");
  }
  if (s.obszary_glebokie !== undefined) {
    cr.obszary_glebokie = tablicaTekstow(s.obszary_glebokie, "cr.obszary_glebokie").map((o) => (o.endsWith("/") ? o : o + "/"));
  }
  if (s.wyjatki !== undefined) {
    const w = obiekt(s.wyjatki, "cr.wyjatki");
    for (const k of Object.keys(w)) {
      if (!KLUCZE_WYJATKOW.includes(k)) throw new BladKonfiguracji(`cr.wyjatki.${k}: nieznany klucz`);
    }
    if (w.nie_kod !== undefined) cr.wyjatki.nie_kod = tablicaTekstow(w.nie_kod, "cr.wyjatki.nie_kod");
    if (w.ryzyko !== undefined) {
      if (!Array.isArray(w.ryzyko)) throw new BladKonfiguracji("cr.wyjatki.ryzyko: oczekiwana tablica");
      cr.wyjatki.ryzyko = w.ryzyko.map((r, i) => {
        obiekt(r, `cr.wyjatki.ryzyko[${i}]`);
        const znak = tekstNiepusty(r.znak, `cr.wyjatki.ryzyko[${i}].znak`);
        const wzor = tekstNiepusty(r.wzor, `cr.wyjatki.ryzyko[${i}].wzor`);
        try {
          new RegExp(wzor);
        } catch (e) {
          throw new BladKonfiguracji(`cr.wyjatki.ryzyko[${i}].wzor: zły regex (${e.message})`);
        }
        return { znak, wzor };
      });
    }
    if (w.pieniadze_tozsamosc !== undefined && w.pieniadze_tozsamosc !== null) {
      cr.wyjatki.pieniadze_tozsamosc = tablicaTekstow(w.pieniadze_tozsamosc, "cr.wyjatki.pieniadze_tozsamosc");
    }
  }
  let sciezki = [];
  if (j.sciezki !== undefined) {
    if (!Array.isArray(j.sciezki)) throw new BladKonfiguracji("sciezki: oczekiwana tablica");
    sciezki = j.sciezki.map((x, i) => {
      obiekt(x, `sciezki[${i}]`);
      return {
        id: tekstNiepusty(x.id, `sciezki[${i}].id`),
        nazwa: typeof x.nazwa === "string" ? x.nazwa : "",
        kategoria: typeof x.kategoria === "string" ? x.kategoria : "",
        pliki: tablicaTekstow(x.pliki ?? [], `sciezki[${i}].pliki`)
      };
    });
  }
  return { cr, sciezki, zrodlo: plik };
}

// ───────────────────────── globy i kontekst ─────────────────────────

// Glob → regex. Obsługiwane: dwugwiazdka z ukośnikiem (zero lub więcej katalogów), dwugwiazdka, gwiazdka, znak zapytania. Reszta dosłownie.
export function kompilujGlob(glob) {
  const g = glob.replaceAll("\\", "/").replace(/^\.\//, "");
  let re = "";
  for (let i = 0; i < g.length; i++) {
    const c = g[i];
    if (c === "*") {
      if (g[i + 1] === "*") {
        if (g[i + 2] === "/") {
          re += "(?:.*/)?";
          i += 2;
        } else {
          re += ".*";
          i += 1;
        }
      } else {
        re += "[^/]*";
      }
    } else if (c === "?") {
      re += "[^/]";
    } else {
      re += c.replace(/[.+^${}()|[\]\\]/g, "\\$&");
    }
  }
  return new RegExp("^" + re + "$");
}

/** Kontekst wyliczony z konfiguracji raz — czyste funkcje biorą go jako `k`. */
export function zbudujKontekst(cfg) {
  const cr = cfg.cr;
  let pieniadze;
  if (cr.wyjatki.pieniadze_tozsamosc) {
    pieniadze = cr.wyjatki.pieniadze_tozsamosc.map(kompilujGlob);
  } else {
    pieniadze = cfg.sciezki
      .filter((s) => /pieni|tożsam|tozsam|dostęp|dostep/i.test(s.kategoria))
      .flatMap((s) => s.pliki)
      .map(kompilujGlob);
  }
  return {
    nieKod: cr.wyjatki.nie_kod.map(kompilujGlob),
    ryzyko: cr.wyjatki.ryzyko.map((r) => ({ znak: r.znak, wzor: new RegExp(r.wzor, "i") })),
    obszaryGlebokie: cr.obszary_glebokie,
    katalogi: cr.katalogi_zrodel,
    pieniadze,
    sciezki: cfg.sciezki.map((s) => ({ id: s.id, nazwa: s.nazwa, globy: s.pliki, testy: s.pliki.map(kompilujGlob) })),
    integracyjne: new Set([...cr.baza_galezi.map((r) => r.replace(/^origin\//, "")), "master", "main"]),
    bazy: cr.baza_galezi
  };
}

// ───────────────────────── pure: klasyfikacja ─────────────────────────

const WZOR_DATY = /^\d{4}-\d{2}-\d{2}$/;

export function czyPoprawnaData(s) {
  if (!WZOR_DATY.test(s ?? "")) return false;
  const d = new Date(s + "T00:00:00Z");
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

export function czyKod(k, sciezka) {
  return !k.nieKod.some((w) => w.test(sciezka));
}

export function czyTest(sciezka) {
  return /\.(test|spec)\.[cm]?[jt]sx?$/.test(sciezka);
}

export function znakiRyzyka(k, sciezki) {
  return k.ryzyko.filter((r) => sciezki.some((s) => r.wzor.test(s))).map((r) => r.znak);
}

function etykietaZKorzenia(korzen) {
  return korzen.replace(/^src\//, "");
}

/** Obszar funkcjonalny ze ścieżki: najpierw `obszary_glebokie`, potem pierwszy katalog (po `src/`). */
export function obszar(k, sciezka) {
  for (const r of k.obszaryGlebokie) {
    if (sciezka.startsWith(r)) {
      const reszta = sciezka.slice(r.length);
      const i = reszta.indexOf("/");
      if (i > 0) return etykietaZKorzenia(r) + reszta.slice(0, i);
    }
  }
  if (!sciezka.includes("/")) return "konfiguracja";
  const cz = sciezka.split("/");
  return cz[0] === "src" && cz.length > 2 ? "src/" + cz[1] : cz[0];
}

/** Odwrotność `obszar()` dla kluczy wpisywanych do rejestru CR (`core/identity` → `src/core/identity/`). */
export function prefiksObszaru(k, klucz) {
  for (const r of k.obszaryGlebokie) {
    const et = etykietaZKorzenia(r);
    if (klucz.startsWith(et)) {
      const reszta = klucz.slice(et.length);
      if (/^[\w.-]+$/.test(reszta)) return r + reszta + "/";
    }
  }
  if (/^src\/[\w.-]+$/.test(klucz)) return klucz + "/";
  return null;
}

/** Katalog domeny do podsumowania pokrycia: trzy pierwsze segmenty; płytszy plik → jego katalog. */
export function domena(sciezka) {
  const cz = sciezka.split("/");
  if (cz.length > 3) return cz.slice(0, 3).join("/");
  return cz.slice(0, -1).join("/") || ".";
}

/** ID zadania z tematu commita — wymagany myślnik odsiewa `PoC`, `CR`, `SQL`. */
export function idZTematu(temat) {
  const wNawiasie = temat.match(/^[a-z]+\(([A-Z0-9][A-Z0-9-]*-[A-Z0-9]+)\)/);
  if (wNawiasie) return wNawiasie[1];
  const wTresci = temat.match(/\b([A-Z][A-Z0-9]*(?:-[A-Z0-9]+)+)\b/);
  return wTresci ? wTresci[1] : null;
}

/** Rodzina epiku: `FUNKCJA-A-1` i `FUNKCJA-A-2` to jedna rzecz do recenzji. */
export function rodzinaId(id) {
  const rodzina = id.replace(/-\d+$/, "");
  return rodzina.length < 3 ? id : rodzina;
}

/** Czy tekst wymienia klucz jako CAŁY token (nie fragment słowa): `A` ⊄ „Fala", `fix/x` ⊄ `fix/x-2`. */
export function wymieniaKlucz(tekst, klucz) {
  const e = klucz.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const po = klucz.includes("/") ? String.raw`(?![\w/-])` : String.raw`(?![\w])`;
  return new RegExp(String.raw`(?<![\w/-])` + e + po).test(tekst);
}

// ───────────────────────── rejestry ─────────────────────────

function komorki(linia) {
  return linia
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split(/(?<!\\)\|/)
    .map((s) => s.trim());
}

/** Odsyłacz do jawnej listy plików (`cr-pliki/<data>-<id>.txt`) w kolumnie Pliki REJESTR-CR. */
export const WZOR_CR_PLIKI = /cr-pliki\/[\w.-]+\.txt/;

/** Treść pliku `cr-pliki/*.txt` → ścieżki (jedna na linię; `#` = komentarz). */
export function sparsujListePlikow(tekst) {
  const linie = tekst
    .split(/\r?\n/)
    .map((l) => l.trim().replaceAll("\\", "/"))
    .filter((l) => l && !l.startsWith("#"));
  return [...new Set(linie)];
}

/**
 * REJESTR-CR.md → wpisy. Czyta TYLKO tabelę z nagłówkiem `Data | Zakres | Typ | Wynik …`.
 * @throws {BladRejestru} brak tabeli; wiersz z niepoprawną datą; wiersz o złej liczbie kolumn.
 */
export function sparsujRejestrCr(tekst) {
  const linie = tekst.split(/\r?\n/);
  const wpisy = [];
  const bledy = [];
  let wTabeli = false;
  let iRundy = -1; // opcjonalna kolumna „Rundy” (limit rund 1+1, decyzja Q7); brak kolumny = null w każdym wpisie
  let znaleziona = false;
  for (let i = 0; i < linie.length; i++) {
    const linia = linie[i];
    if (!linia.trim().startsWith("|")) {
      wTabeli = false;
      continue;
    }
    const kol = komorki(linia);
    if (!wTabeli) {
      if (kol[0] === "Data" && kol[1] === "Zakres" && kol[2] === "Typ" && kol[3] === "Wynik") {
        wTabeli = true;
        znaleziona = true;
        iRundy = kol.findIndex((c) => c.trim().toLowerCase() === "rundy");
        i += 1; // separator |---|
      }
      continue;
    }
    if (kol.length < 5) {
      bledy.push(`linia ${i + 1}: ${kol.length} kolumn zamiast 6`);
      continue;
    }
    if (!czyPoprawnaData(kol[0])) {
      bledy.push(`linia ${i + 1}: data „${kol[0]}" nie jest RRRR-MM-DD`);
      continue;
    }
    const lista = linia.match(WZOR_CR_PLIKI);
    wpisy.push({
      data: kol[0], zakres: kol[1], typ: kol[2], wynik: kol[3], poprawki: kol[4] ?? "", linia: i + 1,
      plikiLista: lista ? lista[0] : null,
      rundy: iRundy >= 0 ? (kol[iRundy] ?? "") : null
    });
  }
  if (!znaleziona) throw new BladRejestru("REJESTR-CR: brak tabeli z nagłówkiem `| Data | Zakres | Typ | Wynik | … |`");
  if (bledy.length) throw new BladRejestru(`REJESTR-CR: ${bledy.length} błędnych wierszy:\n  ` + bledy.join("\n  "));
  return wpisy;
}

/** Data z nagłówka fali: `23.09.2026`, `24.09`, `DOMK-25-09`. Bierzemy OSTATNIE dopasowanie. */
export function dataZNaglowkaFali(naglowek, rokDomyslny) {
  const trafienia = [...naglowek.matchAll(/(?<![\d])(\d{1,2})[.-](\d{2})(?:\.(\d{4}))?(?![\d])/g)];
  for (const m of trafienia.reverse()) {
    const dzien = Number(m[1]);
    const miesiac = Number(m[2]);
    if (dzien < 1 || dzien > 31 || miesiac < 1 || miesiac > 12) continue;
    const rok = m[3] ? Number(m[3]) : rokDomyslny;
    const s = `${rok}-${String(miesiac).padStart(2, "0")}-${String(dzien).padStart(2, "0")}`;
    if (czyPoprawnaData(s)) return s;
  }
  return null;
}

const WZOR_SHA = /(?<![0-9a-zA-Z/_-])([0-9a-f]{7,40})(?![0-9a-zA-Z_-])/g;
const WZOR_ZAKRESU = /(?<![0-9a-zA-Z])([0-9a-f]{7,40})\.\.\.?([0-9a-f]{7,40})(?![0-9a-zA-Z])/g;

const escapuj = (t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Wzorzec „SHA tu jest punktem odniesienia” („Baza: `…`", „od `…`", „<nazwa bazy>: `…`"): słowa
 * ogólne + nazwy gałęzi bazowych z `cr.baza_galezi` (bez `origin/`). SHA przed nim NIE liczy się
 * jako recenzowany commit, bo zawyżałoby pokrycie.
 */
export function wzorOdniesienSha(bazy = []) {
  const nazwy = bazy.map((r) => escapuj(r.replace(/^origin\//, "")));
  const czesci = ["baz[aąyę]", "HEAD w chwili", "punkt(?:u)? startu", "\\bod", "@", ...nazwy];
  return new RegExp(`(${czesci.join("|")})\\W{0,6}[(\`]*\\s*$`, "i");
}

export function wyciagnijShaIZakresy(tekst, bazy = []) {
  const przedOdniesienie = wzorOdniesienSha(bazy);
  const zakresy = [];
  const wZakresach = new Set();
  for (const m of tekst.matchAll(WZOR_ZAKRESU)) {
    zakresy.push({ od: m[1], do: m[2] });
    wZakresach.add(m.index);
    wZakresach.add(m.index + m[0].length - m[2].length);
  }
  const sha = [];
  const odniesienia = [];
  for (const m of tekst.matchAll(WZOR_SHA)) {
    if (wZakresach.has(m.index)) continue;
    if (/^\d+$/.test(m[1])) continue; // czysto dziesiętne ciągi (numery, daty) to nie SHA
    const przed = tekst.slice(Math.max(0, m.index - 40), m.index);
    (przedOdniesienie.test(przed) ? odniesienia : sha).push(m[1]);
  }
  return { sha: [...new Set(sha)], zakresy, odniesienia: [...new Set(odniesienia)] };
}

/** Ścieżki plików wymienione wprost w tekście (`katalog/plik.ext:178` → bez `:178`). */
export function wyciagnijSciezki(tekst) {
  const wynik = new Set();
  for (const m of tekst.matchAll(/(?<![\w/.-])((?:[\w@-]+\/)+[\w@.-]+\.[a-z]{1,5})(?::\d+(?:[,:-]\d+)*)?/g)) {
    wynik.add(m[1]);
  }
  return [...wynik];
}

const WZOR_SKROTU =
  /(?<![\w@[\]().\/-])((?:[\w@[\]().-]+\/)*[\w@[\]().-]*[\w\])]\.(?:tsx|ts|mts|cts|mjs|cjs|jsx|js|json|sql|css))(?![\w])/g;

/** Skróty ścieżek z rejestrów: `checkout/route.ts`, `entitlement.ts`, `core/identity/visitor.ts:40`. */
export function wyciagnijSkroty(tekst) {
  const wynik = new Set();
  for (const m of tekst.matchAll(WZOR_SKROTU)) {
    if (m[1].startsWith(".")) continue;
    wynik.add(m[1]);
  }
  return [...wynik];
}

/** Indeks plików repo pod dopasowanie po sufiksie: nazwa pliku → pełne ścieżki. */
export function indeksSufiksow(pliki) {
  const pelne = new Set(pliki);
  const poNazwie = new Map();
  for (const p of pliki) {
    const n = p.slice(p.lastIndexOf("/") + 1);
    if (!poNazwie.has(n)) poNazwie.set(n, []);
    poNazwie.get(n).push(p);
  }
  return { pelne, poNazwie };
}

/** Skrót → pełna ścieżka TYLKO gdy sufiks jest jednoznaczny. `route.ts` pasuje do wielu → null. */
export function rozwiazSkrot(skrot, indeks) {
  const t = skrot.replaceAll("\\", "/").replace(/^\.\//, "");
  if (indeks.pelne.has(t)) return t;
  const n = t.slice(t.lastIndexOf("/") + 1);
  const kandydaci = (indeks.poNazwie.get(n) ?? []).filter((p) => p === t || p.endsWith("/" + t));
  return kandydaci.length === 1 ? kandydaci[0] : null;
}

export function sciezkiZSkrotow(tekst, indeks) {
  const wynik = new Set();
  for (const s of wyciagnijSkroty(tekst)) {
    const p = rozwiazSkrot(s, indeks);
    if (p) wynik.add(p);
  }
  return [...wynik];
}

/** REJESTR-ZNALEZISK.md (menu i pokrycie) → fale: każda sekcja `## Fala <id>` do następnej `## `. */
export function sparsujFaleRejestru(tekst, { rokDomyslny = new Date().getUTCFullYear(), bazy = [] } = {}) {
  const linie = tekst.split(/\r?\n/);
  const fale = [];
  let biezaca = null;
  for (const linia of linie) {
    const m = linia.match(/^##\s+Fala\s+(.+?)\s*$/);
    if (m) {
      biezaca = { id: m[1], data: dataZNaglowkaFali(m[1], rokDomyslny), linie: [] };
      fale.push(biezaca);
      continue;
    }
    if (/^##\s/.test(linia)) {
      biezaca = null;
      continue;
    }
    if (biezaca) biezaca.linie.push(linia);
  }
  if (fale.length === 0) throw new BladRejestru("REJESTR-ZNALEZISK: brak sekcji `## Fala <id>` — nie wygląda na rejestr znalezisk");
  return fale.map((f) => {
    const tresc = f.linie.join("\n");
    const { sha, zakresy, odniesienia } = wyciagnijShaIZakresy(tresc, bazy);
    return { id: f.id, data: f.data, tresc, sha, zakresy, odniesienia, sciezki: wyciagnijSciezki(tresc) };
  });
}

const WZOR_GALEZI = /(?<![\w/-])((?:feat|fix|docs|release|test|chore|refactor|cr|verify|discovery|wip)\/[\w.\-/]*[\w-])/g;

/** Wiersz REJESTR-CR → z czego da się wyprowadzić listę plików. */
export function tokenyZakresu(k, zakres) {
  const galezie = [...new Set([...zakres.matchAll(WZOR_GALEZI)].map((m) => m[1]))];
  const { sha, zakresy } = wyciagnijShaIZakresy(zakres, k.bazy);
  const obszary = [];
  for (const kawalek of zakres.split(/[,\s]+/)) {
    const p = prefiksObszaru(k, kawalek.replace(/[`()]/g, ""));
    if (p) obszary.push(p);
  }
  return { galezie, sha, zakresy, obszary };
}

/** Status kandydata z menu: najnowszy wpis REJESTR-CR albo fala, która wymienia klucz. */
export function statusDla(klucz, wpisyCr, fale = []) {
  const trafienia = [];
  for (const w of wpisyCr) if (wymieniaKlucz(w.zakres, klucz)) trafienia.push({ data: w.data, opis: w.wynik });
  for (const f of fale) {
    if (f.data && (wymieniaKlucz(f.id, klucz) || wymieniaKlucz(f.tresc, klucz))) trafienia.push({ data: f.data, opis: "Fala " + f.id });
  }
  if (trafienia.length === 0) return { zrobione: false, opis: "bez CR" };
  trafienia.sort((a, b) => (a.data < b.data ? -1 : a.data > b.data ? 1 : 0));
  const ostatni = trafienia[trafienia.length - 1];
  return { zrobione: true, opis: "CR " + ostatni.data + " — " + ostatni.opis, data: ostatni.data };
}

/** Kolejność propozycji = RYZYKO × NIEOSIĄGALNOŚĆ, nie rozmiar. */
export function punkty(pozycja) {
  const bezCr = pozycja.status.zrobione ? 0 : 3;
  return pozycja.osiagalnosc.waga * 3 + pozycja.ryzyko.length * 2 + bezCr + Math.min(3, Math.floor(pozycja.plikiKodu / 10));
}

export function etykietaOsiagalnosci(liczba, naProdukcji, naPodgladzie) {
  if (naProdukcji === liczba) return { etykieta: "na produkcji", waga: 0, naProdukcji, naPodgladzie };
  if (naPodgladzie === liczba) return { etykieta: "na stagingu, NIE na produkcji", waga: 2, naProdukcji, naPodgladzie };
  if (naPodgladzie > 0) return { etykieta: "część na stagingu, reszta niescalona", waga: 3, naProdukcji, naPodgladzie };
  return { etykieta: "NIESCALONE", waga: 3, naProdukcji, naPodgladzie };
}

// ───────────────────────── pokrycie ─────────────────────────

export const STATUS = { NIGDY: "NIGDY", NIEAKTUALNY: "NIEAKTUALNY", AKTUALNY: "AKTUALNY" };

/** Mapa plik → najnowsza recenzja. `zrodla` = [{ data, pliki: string[], zrodlo }]. */
export function zbudujMapeRecenzji(zrodla) {
  const mapa = new Map();
  for (const z of zrodla) {
    if (!czyPoprawnaData(z.data)) continue;
    for (const p of z.pliki) {
      const stary = mapa.get(p);
      if (!stary || z.data > stary.data) mapa.set(p, { data: z.data, zrodlo: z.zrodlo });
    }
  }
  return mapa;
}

/** Granulacja = dzień (tak liczy `git log --format=%cs`). */
export function klasyfikujPlik(sciezka, zmiana, mapa, prefiksy = []) {
  let rec = mapa.get(sciezka) ?? null;
  for (const p of prefiksy) {
    if (sciezka.startsWith(p.prefiks) && (!rec || p.data > rec.data)) rec = { data: p.data, zrodlo: p.zrodlo };
  }
  if (!rec) return { sciezka, zmiana, cr: null, zrodlo: null, status: STATUS.NIGDY };
  const status = zmiana && zmiana > rec.data ? STATUS.NIEAKTUALNY : STATUS.AKTUALNY;
  return { sciezka, zmiana, cr: rec.data, zrodlo: rec.zrodlo, status };
}

function procent(a, b) {
  return b === 0 ? 0 : Math.round((a / b) * 100);
}

export function podsumujPokrycie(wiersze) {
  const licz = (lista) => {
    const aktualne = lista.filter((w) => w.status === STATUS.AKTUALNY).length;
    const nieaktualne = lista.filter((w) => w.status === STATUS.NIEAKTUALNY).length;
    const nigdy = lista.filter((w) => w.status === STATUS.NIGDY).length;
    return { razem: lista.length, aktualne, nieaktualne, nigdy, procent: procent(aktualne, lista.length) };
  };
  const grupy = new Map();
  for (const w of wiersze) {
    const d = domena(w.sciezka);
    if (!grupy.has(d)) grupy.set(d, []);
    grupy.get(d).push(w);
  }
  const perDomena = [...grupy.entries()]
    .map(([nazwa, lista]) => ({ domena: nazwa, ...licz(lista) }))
    .sort((a, b) => b.razem - a.razem || (a.domena < b.domena ? -1 : 1));
  return { ...licz(wiersze), perDomena };
}

const KOLEJNOSC_STATUSU = { NIGDY: 0, NIEAKTUALNY: 1, AKTUALNY: 2 };

export function formatujPokrycie(wiersze, podsumowanie, { tytul = "katalogi źródeł", tabela = true } = {}) {
  const p = podsumowanie;
  const out = [];
  out.push(`# Pokrycie CR — ${tytul}`);
  out.push("");
  out.push(`${p.aktualne}/${p.razem} zrecenzowanych po ostatniej zmianie, ${p.procent}% (NIEAKTUALNY ${p.nieaktualne}, NIGDY ${p.nigdy})`);
  out.push("");
  out.push("## Per katalog domeny");
  out.push("");
  out.push("| Domena | Pliki | AKTUALNY | NIEAKTUALNY | NIGDY | % |");
  out.push("|---|---|---|---|---|---|");
  for (const d of p.perDomena) {
    out.push(`| ${d.domena} | ${d.razem} | ${d.aktualne} | ${d.nieaktualne} | ${d.nigdy} | ${d.procent}% |`);
  }
  if (tabela) {
    out.push("");
    out.push("## Pliki");
    out.push("");
    out.push("| Plik | Ostatnia zmiana | Ostatni CR | Status | Źródło CR |");
    out.push("|---|---|---|---|---|");
    const posortowane = [...wiersze].sort(
      (a, b) => KOLEJNOSC_STATUSU[a.status] - KOLEJNOSC_STATUSU[b.status] || (a.sciezka < b.sciezka ? -1 : 1)
    );
    for (const w of posortowane) {
      out.push(`| ${w.sciezka} | ${w.zmiana ?? "—"} | ${w.cr ?? "—"} | ${w.status} | ${w.zrodlo ?? "—"} |`);
    }
  }
  return out.join("\n");
}

/** `git log --format=%x01%cs --name-only` (od najnowszego) → Map plik → data ostatniej zmiany. */
export function ostatnieZmianyZLogu(surowe) {
  const mapa = new Map();
  let data = null;
  for (const linia of surowe.split(/\r?\n/)) {
    if (linia.startsWith("\x01")) {
      data = linia.slice(1).trim();
      continue;
    }
    const s = linia.trim();
    if (!s || !data) continue;
    if (!mapa.has(s)) mapa.set(s, data);
  }
  return mapa;
}

/** `git log --format=%x01%H|%P|%cs --name-only` → commity z plikami; merge oznaczony `merge: true`. */
export function commityZLogu(surowe) {
  const commity = [];
  let c = null;
  for (const linia of surowe.split(/\r?\n/)) {
    if (linia.startsWith("\x01")) {
      const [sha, rodzice, data] = linia.slice(1).split("|");
      c = { sha, merge: rodzice.trim().split(/\s+/).filter(Boolean).length > 1, data: data.trim(), pliki: [] };
      commity.push(c);
      continue;
    }
    const s = linia.trim();
    if (s && c) c.pliki.push(s);
  }
  return commity;
}

export function pozniejsza(a, b) {
  if (!a) return b;
  if (!b) return a;
  return a > b ? a : b;
}

/** Commity z okna osiągalne z każdego refu — liczone W PAMIĘCI z jednego `git log --all`. */
export function commityGalezi(tipy, rodzice, wOknie) {
  const wynik = new Map();
  for (const [ref, tip] of tipy) {
    if (!rodzice.has(tip)) continue;
    const widziane = new Set();
    const stos = [tip];
    const lista = [];
    while (stos.length) {
      const s = stos.pop();
      if (widziane.has(s) || !rodzice.has(s)) continue;
      widziane.add(s);
      if (wOknie.has(s)) lista.push(s);
      for (const r of rodzice.get(s)) stos.push(r);
    }
    if (lista.length) wynik.set(ref, lista);
  }
  return wynik;
}

/**
 * `--sciezka=` → filtr plików:
 *   - ID ścieżek krytycznych z `sciezki` w konfiguracji (`P1`, `P1,P4`, albo `id` z pliku) → globy;
 *   - inaczej prefiks katalogu (`src/lib/payments/`);
 *   - brak flagi → katalogi z `cr.katalogi_zrodel`.
 * Nieznany ID ścieżki krytycznej = błąd (fail-closed), nie „zero plików".
 */
export function filtrSciezki(k, wartosc) {
  if (wartosc === null) {
    wymagane(k.katalogi, "katalogi_zrodel");
    return {
      tryb: "katalogi",
      tytul: k.katalogi.join(", "),
      test: (p) => k.katalogi.some((x) => p.startsWith(x)),
      pathspec: k.katalogi
    };
  }
  const w = wartosc.trim().replaceAll("\\", "/");
  if (!w) throw new BladUzycia("--sciezka= jest puste");
  const czesci = w.split(/\s*,\s*/);
  const znaneId = (c) => k.sciezki.some((s) => s.id.toLowerCase() === c.toLowerCase());
  const pTryb = czesci.every((c) => /^P\d+$/i.test(c) || znaneId(c));
  if (pTryb) {
    const nieznane = czesci.filter((c) => !znaneId(c));
    if (nieznane.length) {
      const sa = k.sciezki.map((s) => s.id).join(",") || "(brak sekcji sciezki w konfiguracji)";
      throw new BladUzycia(`--sciezka: nieznane ścieżki krytyczne ${nieznane.join(",")}; są: ${sa}`);
    }
    const wybrane = k.sciezki.filter((s) => czesci.some((c) => c.toLowerCase() === s.id.toLowerCase()));
    const testy = wybrane.flatMap((s) => s.testy);
    return {
      tryb: "sciezki-krytyczne",
      tytul: wybrane.map((s) => `${s.id} ${s.nazwa}`.trim()).join(" + "),
      test: (p) => testy.some((r) => r.test(p)),
      pathspec: null
    };
  }
  return { tryb: "prefiks", tytul: w + "**", test: (p) => p.startsWith(w), pathspec: [w] };
}

/** Stabilny kształt JSON (nie zmieniać nazw pól — ich używa późniejszy retest obszaru). */
export function wierszDoJson(w) {
  return { plik: w.sciezka, ostatniaZmiana: w.zmiana, ostatniCR: w.cr, status: w.status, zrodloCR: w.zrodlo };
}

/** Refy integracyjne: ich treść nie jest pracą żadnej gałęzi tematycznej. */
export function czyRefIntegracyjny(k, nazwa) {
  const n = nazwa.replace(/^origin\//, "");
  return k.integracyjne.has(n) || n.startsWith("release/");
}

/**
 * Oś GAŁĘZI = co gałąź DOKŁADA ponad refy integracyjne (produkcja, staging, master, wydania).
 * Bez tego odjęcia każda gałąź założona od stagingu „miałaby" wszystkie jego commity.
 */
export function wkladGalezi(k, naGalezi) {
  const integracyjne = [...naGalezi.keys()].filter((r) => czyRefIntegracyjny(k, r));
  const wynik = new Map();
  for (const [ref, shas] of naGalezi) {
    const kanon = ref.replace(/^origin\//, "");
    const odjac = new Set();
    for (const inny of integracyjne) {
      if (inny.replace(/^origin\//, "") === kanon) continue;
      for (const s of naGalezi.get(inny)) odjac.add(s);
    }
    const wlasne = shas.filter((s) => !odjac.has(s));
    if (wlasne.length) wynik.set(ref, wlasne);
  }
  return wynik;
}

// ───────────────────────── raport POKRYCIE-CR.md (--zapisz) ─────────────────────────

export function czyPieniadzeTozsamosc(k, sciezka) {
  return k.pieniadze.some((w) => w.test(sciezka));
}

/** Dwa przebiegi klasyfikacji tego samego zbioru → jeden wiersz na plik. `cr` = bez audytu, `rec` = CR ∪ audyt. */
export function polaczPrzebiegi(wierszeCr, wierszeRec) {
  const poSciezce = new Map(wierszeRec.map((w) => [w.sciezka, w]));
  return wierszeCr.map((c) => ({ sciezka: c.sciezka, zmiana: c.zmiana, cr: c, rec: poSciezce.get(c.sciezka) ?? c }));
}

function liczGrupe(lista) {
  const n = (f) => lista.filter(f).length;
  const razem = lista.length;
  const crAkt = n((w) => w.cr.status === STATUS.AKTUALNY);
  const recAkt = n((w) => w.rec.status === STATUS.AKTUALNY);
  return {
    razem,
    crAkt,
    tylkoAudyt: n((w) => w.cr.status !== STATUS.AKTUALNY && w.rec.status === STATUS.AKTUALNY),
    nieaktualne: n((w) => w.rec.status === STATUS.NIEAKTUALNY),
    nigdy: n((w) => w.rec.status === STATUS.NIGDY),
    procentCr: procent(crAkt, razem),
    procentRec: procent(recAkt, razem)
  };
}

const WIERSZ_GRUPY = (nazwa, g) =>
  `| ${nazwa} | ${g.razem} | ${g.crAkt} | ${g.tylkoAudyt} | ${g.nieaktualne} | ${g.nigdy} | ${g.procentCr}% | ${g.procentRec}% |`;
const NAGLOWEK_GRUPY = (pierwsza) => [
  `| ${pierwsza} | Pliki | CR aktualny | + tylko audyt | NIEAKTUALNY | NIGDY | % CR | % recenzja kodu |`,
  "|---|---|---|---|---|---|---|---|"
];

/** POKRYCIE-CR.md — czysta funkcja: dane → markdown. */
export function formatujRaportPokrycia({ wiersze, sciezki, pieniadze, opisPieniedzy, tytulZakresu, wygenerowano, zrodla }) {
  const out = [];
  const ogol = liczGrupe(wiersze);
  out.push(`# Pokrycie CR — ${tytulZakresu} (bez testów)`);
  out.push("");
  out.push("> **Plik GENEROWANY — nie edytuj ręcznie.** Źródło: REJESTR-CR (wiersze + listy `cr-pliki/*.txt`)");
  out.push("> i sekcje `## Fala` w REJESTR-ZNALEZISK. Odśwież po każdym CR, w tym samym commicie co wiersz:");
  out.push("> `node scripts/cr-zakresy.mjs --pokrycie --zapisz=<ten plik>`.");
  out.push(">");
  out.push(`> Wygenerowano: ${wygenerowano} · mianownik = pliki kodu bez testów w bieżącym checkoucie`);
  out.push("");
  out.push("**Jak czytać.** `CR aktualny` = plik objęty recenzją (wiersz REJESTR-CR bez typu `audyt`, fala REJESTR-ZNALEZISK)");
  out.push("w dniu ostatniej zmiany albo później. `+ tylko audyt` = aktualny wyłącznie dzięki audytowi (typ `audyt`).");
  out.push("`NIEAKTUALNY` = zrecenzowany, potem zmieniony. `NIGDY` = bez żadnego śladu recenzji. „Objęty” znaczy: plik jest na liście");
  out.push("`cr-pliki`, w zakresie zrecenzowanej gałęzi/commitu albo wymieniony w rejestrze pełną ścieżką lub jednoznacznym sufiksem —");
  out.push("to najlepsze oszacowanie z dokumentów, nie dowód lektury linia po linii.");
  out.push("");
  out.push("## Podsumowanie");
  out.push("");
  out.push(`- Pliki: **${ogol.razem}**`);
  out.push(`- CR (bez audytu): **${ogol.crAkt}/${ogol.razem} = ${ogol.procentCr}%**`);
  out.push(`- Recenzja kodu (CR ∪ audyt): **${ogol.crAkt + ogol.tylkoAudyt}/${ogol.razem} = ${ogol.procentRec}%**`);
  out.push(`- NIEAKTUALNY: ${ogol.nieaktualne} · NIGDY: ${ogol.nigdy}`);
  out.push(
    `- Źródła: ${zrodla.wierszeCr} wierszy REJESTR-CR (${zrodla.zListami} z listą \`cr-pliki\`), ${zrodla.fale} fal REJESTR-ZNALEZISK; ` +
      `nierozwiązanych odwołań: ${zrodla.nierozwiazane} (\`--pokrycie --json\` → pole \`nierozwiazane\`)`
  );
  out.push("");
  if (sciezki.length) {
    out.push("## Ścieżki krytyczne");
    out.push("");
    out.push(...NAGLOWEK_GRUPY("Ścieżka"));
    for (const s of sciezki) out.push(WIERSZ_GRUPY(`${s.id} ${s.nazwa}`.trim(), liczGrupe(wiersze.filter((w) => s.test(w.sciezka)))));
    out.push("");
  }
  if (pieniadze.length) {
    const pt = wiersze.filter((w) => pieniadze.some((r) => r.test(w.sciezka)));
    out.push("## Pieniądze i tożsamość");
    out.push("");
    out.push(`Zakres: ${opisPieniedzy}.`);
    out.push("");
    out.push(...NAGLOWEK_GRUPY("Zakres"));
    out.push(WIERSZ_GRUPY("pieniądze + tożsamość", liczGrupe(pt)));
    out.push("");
    const luki = pt
      .filter((w) => w.rec.status !== STATUS.AKTUALNY)
      .sort((a, b) => (a.rec.status < b.rec.status ? -1 : a.rec.status > b.rec.status ? 1 : a.sciezka < b.sciezka ? -1 : 1));
    out.push(`### NIGDY / NIEAKTUALNY (${luki.length})`);
    out.push("");
    if (luki.length === 0) out.push("— brak");
    else {
      out.push("| Plik | Status | Ostatnia zmiana | Ostatnia recenzja | Źródło |");
      out.push("|---|---|---|---|---|");
      for (const w of luki) out.push(`| ${w.sciezka} | ${w.rec.status} | ${w.zmiana ?? "—"} | ${w.rec.cr ?? "—"} | ${w.rec.zrodlo ?? "—"} |`);
    }
    out.push("");
  }
  out.push("## Per katalog domeny");
  out.push("");
  out.push(...NAGLOWEK_GRUPY("Domena"));
  const grupy = new Map();
  for (const w of wiersze) {
    const d = domena(w.sciezka);
    if (!grupy.has(d)) grupy.set(d, []);
    grupy.get(d).push(w);
  }
  const dom = [...grupy.entries()].map(([n, l]) => [n, liczGrupe(l)]).sort((a, b) => b[1].razem - a[1].razem || (a[0] < b[0] ? -1 : 1));
  for (const [n, g] of dom) out.push(WIERSZ_GRUPY(n, g));
  out.push("");
  return out.join("\n");
}

// ───────────────────────── git ─────────────────────────

function git(args, { input } = {}) {
  const r = spawnSync("git", args, { encoding: "utf8", maxBuffer: 256 * 1024 * 1024, input });
  return { ok: r.status === 0, out: r.stdout || "", err: r.stderr || "" };
}

function refIstnieje(ref) {
  return git(["rev-parse", "--verify", "--quiet", `${ref}^{commit}`]).ok;
}

/** Data LOKALNA — „dzisiaj" właściciela, nie UTC. */
function dzisiaj() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function minusDni(data, n) {
  return new Date(Date.parse(data + "T00:00:00Z") - n * 86400000).toISOString().slice(0, 10);
}

/** Pliki rejestrów: ścieżki z flag nadpisują konfigurację. Brak / nieczytelny = BladRejestru (kod 2). */
function wczytajRejestry(a, cfg) {
  const plikCr = wymagane(a.wartosc("rejestr-cr", cfg.cr.rejestr_cr), "rejestr_cr");
  const plikZn = wymagane(a.wartosc("rejestr-znalezisk", cfg.cr.rejestr_znalezisk), "rejestr_znalezisk");
  for (const p of [plikCr, plikZn]) {
    if (!existsSync(p)) throw new BladRejestru(`brak pliku ${p} — bez rejestru status CR jest nieznany, nie „bez CR"`);
  }
  const wpisyCr = sparsujRejestrCr(readFileSync(plikCr, "utf8"));
  const fale = sparsujFaleRejestru(readFileSync(plikZn, "utf8"), { bazy: cfg.cr.baza_galezi });
  return { plikCr, plikZn, wpisyCr, fale };
}

function bazyGalezi(a, cfg) {
  const bazy = [...(a.ma("baza-1") ? cfg.cr.baza_galezi : wymagane(cfg.cr.baza_galezi, "baza_galezi"))];
  if (a.ma("baza-1")) bazy[0] = a.wartosc("baza-1");
  if (a.ma("baza-2") && bazy.length > 1) bazy[1] = a.wartosc("baza-2");
  for (const ref of bazy) {
    if (!refIstnieje(ref)) throw new BladUzycia(`brak refu ${ref} — zrób \`git fetch origin\``);
  }
  return bazy;
}

// ───────────────────────── tryb MENU ─────────────────────────

function oknoCzasu(a) {
  const dzis = dzisiaj();
  let od;
  let doDnia;
  if (a.ma("dzien")) {
    od = doDnia = a.wartosc("dzien");
  } else if (a.ma("od") || a.ma("do")) {
    od = a.wartosc("od", a.wartosc("do"));
    doDnia = a.wartosc("do", dzis);
  } else {
    const dni = Number(a.wartosc("dni", "1"));
    if (!Number.isInteger(dni) || dni < 1) throw new BladUzycia(`--dni musi być liczbą całkowitą ≥ 1, jest „${a.wartosc("dni")}"`);
    od = minusDni(dzis, dni - 1);
    doDnia = dzis;
  }
  for (const d of [od, doDnia]) {
    if (!czyPoprawnaData(d)) throw new BladUzycia(`data „${d}" nie jest RRRR-MM-DD`);
  }
  if (od > doDnia) throw new BladUzycia(`--od (${od}) jest po --do (${doDnia})`);
  return { od, doDnia };
}

function commityZOkna(od, doDnia) {
  const SEP = "@@KOMMIT@@";
  const surowe = git([
    "log", "--all", "--no-merges",
    "--since=" + od + " 00:00:00", "--until=" + doDnia + " 23:59:59",
    "--numstat", "--format=" + SEP + "%H|%ad|%an|%s", "--date=short"
  ]).out;
  const commity = new Map();
  for (const blok of surowe.split(SEP).slice(1)) {
    const [naglowek, ...linie] = blok.split("\n");
    const [sha, data, autor, ...reszta] = naglowek.split("|");
    const pliki = [];
    for (const linia of linie) {
      const m = linia.match(/^(\d+|-)\t(\d+|-)\t(.+)$/);
      if (m) pliki.push({ dodane: Number(m[1]) || 0, usuniete: Number(m[2]) || 0, sciezka: m[3] });
    }
    commity.set(sha, { sha, data, autor, temat: reszta.join("|"), pliki });
  }
  return commity;
}

function sumujPliki(commity) {
  const pliki = new Map();
  for (const c of commity) {
    for (const p of c.pliki) {
      const s = pliki.get(p.sciezka) ?? { dodane: 0, usuniete: 0 };
      s.dodane += p.dodane;
      s.usuniete += p.usuniete;
      pliki.set(p.sciezka, s);
    }
  }
  return pliki;
}

function rozmiar(k, pliki) {
  let dodane = 0;
  let usuniete = 0;
  let plikiKodu = 0;
  for (const [sciezka, s] of pliki) {
    if (!czyKod(k, sciezka)) continue;
    plikiKodu += 1;
    dodane += s.dodane;
    usuniete += s.usuniete;
  }
  return { plikiKodu, dodane, usuniete, plikiWszystkie: pliki.size };
}

function menu(a, cfg, k) {
  const { od, doDnia } = oknoCzasu(a);
  const bazy = bazyGalezi(a, cfg);
  const { plikCr, wpisyCr, fale } = wczytajRejestry(a, cfg);
  const commity = commityZOkna(od, doDnia);

  // osiągalność: zbiory commitów pierwszej i drugiej bazy z okna (+30 dni zapasu)
  const zapas = `--since=${minusDni(od, 30)} 00:00:00`;
  const naProd = new Set(git(["rev-list", zapas, bazy[0]]).out.split("\n").filter(Boolean));
  const naStag = new Set(git(["rev-list", zapas, bazy[1] ?? bazy[0]]).out.split("\n").filter(Boolean));
  const osiagalnosc = (shas) =>
    etykietaOsiagalnosci(shas.length, shas.filter((s) => naProd.has(s)).length, shas.filter((s) => naStag.has(s)).length);
  const status = (klucz) => statusDla(klucz, wpisyCr, fale);

  // gałęzie — jeden graf okna, przejście w pamięci
  const rodzice = new Map();
  for (const linia of git(["log", "--all", `--since=${od} 00:00:00`, "--format=%H %P"]).out.split("\n")) {
    const [sha, ...r] = linia.trim().split(/\s+/);
    if (sha) rodzice.set(sha, r);
  }
  const refy = git(["for-each-ref", "--format=%(refname:short)|%(refname)|%(objectname)", "refs/heads", "refs/remotes/origin"])
    .out.split("\n").map((s) => s.trim()).filter(Boolean);
  const tipy = new Map();
  const pelne = new Map();
  for (const linia of refy) {
    const [nazwa, pelny, sha] = linia.split("|");
    if (nazwa.endsWith("/HEAD")) continue;
    tipy.set(nazwa, sha);
    pelne.set(nazwa, pelny);
  }
  const naGalezi = wkladGalezi(k, commityGalezi(tipy, rodzice, new Set(commity.keys())));
  const wg = new Map();
  for (const [nazwa, shas] of naGalezi) {
    const pelny = pelne.get(nazwa);
    const kanoniczna = nazwa.replace(/^origin\//, "");
    const stary = wg.get(kanoniczna);
    if (stary && stary.shas.length >= shas.length) continue;
    wg.set(kanoniczna, { nazwa: kanoniczna, ref: nazwa, pelny, shas });
  }
  const galezie = [];
  const widziane = new Map();
  for (const { nazwa, ref, pelny, shas } of wg.values()) {
    if (czyRefIntegracyjny(k, nazwa) || nazwa === "origin") continue;
    if (!nazwa.includes("/") && pelny.startsWith("refs/remotes")) continue;
    const odcisk = [...shas].sort().join(",");
    if (widziane.has(odcisk)) {
      widziane.get(odcisk).aliasy.push(nazwa);
      continue;
    }
    const jego = shas.map((s) => commity.get(s));
    const pliki = sumujPliki(jego);
    const r = rozmiar(k, pliki);
    if (r.plikiKodu === 0) continue;
    const wpis = {
      typ: "galaz", klucz: nazwa, ref, aliasy: [], commity: shas.length, ...r,
      ryzyko: znakiRyzyka(k, [...pliki.keys()]), osiagalnosc: osiagalnosc(shas),
      status: status(nazwa), tematy: jego.slice(0, 3).map((c) => c.temat)
    };
    widziane.set(odcisk, wpis);
    galezie.push(wpis);
  }

  // obszary
  const kubelki = new Map();
  for (const c of commity.values()) {
    for (const p of c.pliki) {
      if (!czyKod(k, p.sciezka)) continue;
      const n = obszar(k, p.sciezka);
      const kb = kubelki.get(n) ?? { nazwa: n, pliki: new Set(), shas: new Set(), dodane: 0, usuniete: 0 };
      kb.pliki.add(p.sciezka);
      kb.shas.add(c.sha);
      kb.dodane += p.dodane;
      kb.usuniete += p.usuniete;
      kubelki.set(n, kb);
    }
  }
  const obszary = [...kubelki.values()].map((kb) => ({
    typ: "obszar", klucz: kb.nazwa, commity: kb.shas.size, plikiKodu: kb.pliki.size,
    dodane: kb.dodane, usuniete: kb.usuniete, ryzyko: znakiRyzyka(k, [...kb.pliki]),
    osiagalnosc: osiagalnosc([...kb.shas]), status: status(kb.nazwa), tematy: []
  }));

  // epiki
  const rodziny = new Map();
  for (const c of commity.values()) {
    const id = idZTematu(c.temat);
    if (!id) continue;
    const n = rodzinaId(id);
    const r = rodziny.get(n) ?? { nazwa: n, commity: [], idy: new Set() };
    r.commity.push(c);
    r.idy.add(id);
    rodziny.set(n, r);
  }
  const epiki = [];
  for (const r of rodziny.values()) {
    const pliki = sumujPliki(r.commity);
    const roz = rozmiar(k, pliki);
    if (roz.plikiKodu === 0) continue;
    epiki.push({
      typ: "epik", klucz: r.nazwa, commity: r.commity.length, ...roz,
      ryzyko: znakiRyzyka(k, [...pliki.keys()]), osiagalnosc: osiagalnosc(r.commity.map((c) => c.sha)),
      status: status(r.nazwa), tematy: [...r.idy].slice(0, 4)
    });
  }

  const sortuj = (l) => l.sort((x, y) => punkty(y) - punkty(x));
  sortuj(galezie);
  sortuj(obszary);
  sortuj(epiki);

  if (a.ma("json")) {
    console.log(JSON.stringify({ od, do: doDnia, galezie, epiki, obszary }, null, 2));
    return 0;
  }
  if (commity.size === 0) {
    console.log(`Brak commitów w oknie ${od}..${doDnia} na jakimkolwiek refie. Podaj szersze okno, np. --dni=7.`);
    return 0;
  }
  const autorzy = new Set([...commity.values()].map((c) => c.autor));
  console.log(`# Kandydaci do CR — ${od}..${doDnia}`);
  console.log(
    `\n${commity.size} commitów, ${autorzy.size} autor(ów). Rejestr CR: ${wpisyCr.length} wpisów, ` +
      `rejestr znalezisk: ${fale.length} fal.`
  );
  const LIMIT = 12;
  let n = 1;
  const drukuj = (tytul, lista) => {
    if (lista.length === 0) return;
    console.log("\n## " + tytul);
    for (const p of lista.slice(0, LIMIT)) {
      const ryz = p.ryzyko.length ? "  [" + p.ryzyko.join(" ") + "]" : "";
      const st = p.status.zrobione ? "OK " + p.status.opis : "-- bez CR";
      const alias = p.aliasy?.length ? "\n    ta sama treść pod nazwami: " + p.aliasy.join(", ") : "";
      console.log(
        String(n).padStart(2) + ". " + p.klucz + ryz + "\n" +
          "    " + p.commity + " commit(ów) | " + p.plikiKodu + " plików kodu | +" + p.dodane + "/-" + p.usuniete +
          " | " + p.osiagalnosc.etykieta + " | " + st + alias +
          (p.tematy.length ? "\n    " + p.tematy.join(" | ") : "")
      );
      n += 1;
    }
    if (lista.length > LIMIT) console.log(`    (+${lista.length - LIMIT} dalszych — pokaże je --json)`);
  };
  drukuj("Gałęzie — co każda DOKŁADA ponad bazy integracyjne (praca niescalona)", galezie);
  drukuj("Epiki / ID zadań (jedna intencja, może leżeć na kilku gałęziach)", epiki);
  drukuj("Obszary funkcjonalne (przekrojowo, niezależnie od gałęzi)", obszary);
  console.log(
    `\n---\nWybierz numery (np. 1 i 4). Po recenzji dopisz wiersz do ${plikCr} ` +
      "z kluczem DOKŁADNIE jak wyżej — inaczej następny przebieg znów pokaże to samo jako bez-CR."
  );
  return 0;
}

// ───────────────────────── tryb POKRYCIE ─────────────────────────

/** Skrócone SHA → pełne, tylko te, które są commitami w tym repo. */
function rozwinSha(krotkie) {
  if (krotkie.length === 0) return new Map();
  const r = git(["cat-file", "--batch-check"], { input: krotkie.join("\n") + "\n" });
  const linie = r.out.split("\n");
  const mapa = new Map();
  krotkie.forEach((kr, i) => {
    const m = (linie[i] ?? "").match(/^([0-9a-f]{40}) commit /);
    if (m) mapa.set(kr, m[1]);
  });
  return mapa;
}

function commityPoSha(pelne) {
  if (pelne.length === 0) return new Map();
  const r = git(["log", "--no-walk=unsorted", "--stdin", "--format=%x01%H|%P|%cs", "--name-only"], {
    input: [...new Set(pelne)].join("\n") + "\n"
  });
  return new Map(commityZLogu(r.out).map((c) => [c.sha, c]));
}

function commityZakresu(args) {
  const r = git(["log", "--no-merges", "--format=%x01%H|%P|%cs", "--name-only", ...args]);
  return r.ok ? commityZLogu(r.out) : null;
}

function zrodlaRecenzji(k, wpisyCr, fale, bazy, { plikCr, indeks }) {
  const zrodla = [];
  const prefiksy = [];
  const nierozwiazane = [];

  const wszystkieKrotkie = new Set();
  const tokenyCr = wpisyCr.map((w) => ({ w, t: tokenyZakresu(k, w.zakres + " " + w.poprawki) }));
  for (const { t } of tokenyCr) t.sha.forEach((s) => wszystkieKrotkie.add(s));
  for (const f of fale) f.sha.forEach((s) => wszystkieKrotkie.add(s));
  const pelne = rozwinSha([...wszystkieKrotkie]);
  const commity = commityPoSha([...pelne.values()]);

  const zSha = (krotkie, dataCr, etykieta) => {
    let najpozniej = null;
    for (const kr of krotkie) {
      const c = commity.get(pelne.get(kr));
      if (!c) {
        nierozwiazane.push(`${etykieta}: SHA ${kr} nie istnieje w tym repo`);
        continue;
      }
      if (c.merge) {
        nierozwiazane.push(`${etykieta}: ${kr} to merge — bez listy plików (recenzja osi, nie pliku)`);
        continue;
      }
      const data = pozniejsza(dataCr, c.data);
      najpozniej = pozniejsza(najpozniej, data);
      zrodla.push({ data, pliki: c.pliki, zrodlo: etykieta });
    }
    return najpozniej;
  };
  const zZakresow = (zakresy, dataCr, etykieta) => {
    let najpozniej = null;
    for (const { od, do: doSha } of zakresy) {
      const lista = commityZakresu([`${od}..${doSha}`]);
      if (!lista) {
        nierozwiazane.push(`${etykieta}: zakres ${od}..${doSha} nie rozwiązuje się`);
        continue;
      }
      for (const c of lista) {
        const data = dataCr ?? c.data;
        najpozniej = pozniejsza(najpozniej, data);
        zrodla.push({ data, pliki: c.pliki, zrodlo: etykieta });
      }
    }
    return najpozniej;
  };

  for (const { w, t } of tokenyCr) {
    const etykieta = `REJESTR-CR ${w.data} (linia ${w.linia})`;
    const audyt = w.typ.trim().toLowerCase() === "audyt";
    const przed = zrodla.length;
    zSha(t.sha, w.data, etykieta);
    zZakresow(t.zakresy, w.data, etykieta);
    for (const p of t.obszary) prefiksy.push({ prefiks: p, data: w.data, zrodlo: etykieta, audyt });
    const zTekstu = sciezkiZSkrotow(w.zakres + " " + w.poprawki, indeks);
    if (zTekstu.length) zrodla.push({ data: w.data, pliki: zTekstu, zrodlo: etykieta });
    if (w.plikiLista) {
      const sciezkaListy = join(dirname(plikCr), w.plikiLista);
      if (!existsSync(sciezkaListy)) {
        throw new BladRejestru(`${etykieta}: odsyłacz ${w.plikiLista}, a pliku ${sciezkaListy} nie ma — lista zgubiona, pokrycie byłoby zaniżone po cichu`);
      }
      zrodla.push({ data: w.data, pliki: sparsujListePlikow(readFileSync(sciezkaListy, "utf8")), zrodlo: `${etykieta} ${w.plikiLista}` });
    }
    for (let i = przed; i < zrodla.length; i++) zrodla[i].audyt = audyt;
    const przedGalezmi = zrodla.length;
    for (const g of w.plikiLista ? [] : t.galezie) {
      if (g.startsWith("release/")) continue;
      const ref = [g, `origin/${g}`].find(refIstnieje);
      if (!ref) {
        nierozwiazane.push(`${etykieta}: gałąź ${g} nie istnieje (ani lokalnie, ani na origin)`);
        continue;
      }
      const doCr = `--until=${w.data} 23:59:59`;
      let lista = commityZakresu([doCr, ref, "--not", ...bazy]);
      if (lista && lista.length === 0) {
        // gałąź już scalona: pierwszy merge, który ją wciągnął, wyznacza jej commity (M^1..gałąź)
        lista = [];
        for (const baza of bazy) {
          const m = git(["rev-list", "--ancestry-path", "--merges", "--reverse", `${ref}..${baza}`]).out.split("\n")[0].trim();
          if (!m) continue;
          lista = commityZakresu([doCr, `${m}^1..${ref}`]) ?? [];
          if (lista.length) break;
        }
      }
      if (!lista || lista.length === 0) {
        nierozwiazane.push(`${etykieta}: gałąź ${g} — nie da się wyznaczyć jej commitów sprzed daty CR`);
        continue;
      }
      for (const c of lista) zrodla.push({ data: w.data, pliki: c.pliki, zrodlo: `${etykieta} ${g}` });
    }
    for (let i = przedGalezmi; i < zrodla.length; i++) zrodla[i].audyt = audyt;
  }

  for (const f of fale) {
    const etykieta = `Fala ${f.id}`;
    const przed = zrodla.length;
    const pShas = zSha(f.sha, f.data, etykieta);
    const pZakr = zZakresow(f.zakresy, f.data, etykieta);
    const dataSciezek = f.data ?? pozniejsza(pShas, pZakr);
    const sciezki = [...new Set([...f.sciezki, ...sciezkiZSkrotow(f.tresc, indeks)])];
    if (sciezki.length) {
      if (!dataSciezek) nierozwiazane.push(`${etykieta}: ${sciezki.length} ścieżek, ale fala bez daty i bez SHA`);
      else zrodla.push({ data: dataSciezek, pliki: sciezki, zrodlo: etykieta });
    }
    const audyt = /^AUDYT/i.test(f.id);
    for (let i = przed; i < zrodla.length; i++) zrodla[i].audyt = audyt;
  }
  return { zrodla, prefiksy, nierozwiazane };
}

function pokrycie(a, cfg, k) {
  const bazy = bazyGalezi(a, cfg);
  const filtrStatusu = a.ma("status")
    ? a.wartosc("status").split(",").map((s) => s.trim().toUpperCase()).filter(Boolean)
    : null;
  if (filtrStatusu) {
    const zle = filtrStatusu.filter((s) => !STATUS[s]);
    if (zle.length || filtrStatusu.length === 0) throw new BladUzycia(`--status: nieznane ${zle.join(",") || "(puste)"}; dozwolone NIGDY,NIEAKTUALNY,AKTUALNY`);
  }
  const { plikCr, wpisyCr, fale } = wczytajRejestry(a, cfg);
  const zapisz = a.ma("zapisz") ? a.wartosc("zapisz") : null;
  if (zapisz !== null) {
    if (!zapisz) throw new BladUzycia("--zapisz= jest puste — podaj ścieżkę, np. POKRYCIE-CR.md");
    for (const f of ["zakres", "sciezka", "status", "json"]) {
      if (a.ma(f)) throw new BladUzycia(`--zapisz liczy zawsze całe katalogi źródeł — bez --${f}`);
    }
  }

  const filtr = filtrSciezki(k, a.ma("sciezka") ? a.wartosc("sciezka") : null);

  let pliki;
  let tytul;
  if (a.ma("zakres")) {
    const zakres = a.wartosc("zakres");
    const r = git(["diff", "--name-only", "--diff-filter=d", zakres]);
    if (!r.ok) throw new BladUzycia(`--zakres=${zakres} nie rozwiązuje się: ${r.err.trim()}`);
    pliki = r.out.split("\n").map((s) => s.trim()).filter(Boolean);
    if (a.ma("sciezka")) pliki = pliki.filter(filtr.test);
    tytul = `zakres ${zakres}${a.ma("sciezka") ? ` ∩ ${filtr.tytul}` : ""}`;
  } else {
    const wszystkie = git(["ls-files", "--", ...(filtr.pathspec ?? [])]).out;
    pliki = wszystkie.split("\n").map((s) => s.trim()).filter(Boolean).filter(filtr.test).filter((p) => !czyTest(p) && czyKod(k, p));
    tytul = `${filtr.tytul} (bez testów)`;
  }
  if (pliki.length === 0) throw new BladUzycia(`zero plików dla ${tytul} — zły prefiks, pusta ścieżka albo pusty zakres`);

  const zmiany = ostatnieZmianyZLogu(
    git(["log", "--format=%x01%cs", "--name-only", "--", ...(a.ma("zakres") || !filtr.pathspec ? ["."] : filtr.pathspec)]).out
  );
  const indeks = indeksSufiksow(git(["ls-files"]).out.split("\n").map((s) => s.trim()).filter(Boolean));
  const { zrodla, prefiksy, nierozwiazane } = zrodlaRecenzji(k, wpisyCr, fale, bazy, { plikCr, indeks });
  const mapa = zbudujMapeRecenzji(zrodla);
  const wiersze = pliki.map((p) => klasyfikujPlik(p, zmiany.get(p) ?? null, mapa, prefiksy));

  if (zapisz !== null) {
    // drugi przebieg bez audytu: „CR" vs „recenzja kodu (CR ∪ audyt)"
    const mapaCr = zbudujMapeRecenzji(zrodla.filter((z) => !z.audyt));
    const prefiksyCr = prefiksy.filter((p) => !p.audyt);
    const wierszeCr = pliki.map((p) => klasyfikujPlik(p, zmiany.get(p) ?? null, mapaCr, prefiksyCr));
    const md = formatujRaportPokrycia({
      wiersze: polaczPrzebiegi(wierszeCr, wiersze),
      sciezki: k.sciezki.map((s) => ({ id: s.id, nazwa: s.nazwa, test: (p) => s.testy.some((r) => r.test(p)) })),
      pieniadze: k.pieniadze,
      opisPieniedzy: cfg.cr.wyjatki.pieniadze_tozsamosc
        ? cfg.cr.wyjatki.pieniadze_tozsamosc.join(", ")
        : "pliki ścieżek krytycznych o kategorii pieniądze/tożsamość/dostęp",
      tytulZakresu: k.katalogi.join(", "),
      wygenerowano: new Date().toISOString().slice(0, 16).replace("T", " ") + " UTC",
      zrodla: { wierszeCr: wpisyCr.length, zListami: wpisyCr.filter((w) => w.plikiLista).length, fale: fale.length, nierozwiazane: nierozwiazane.length }
    });
    const cr = wierszeCr.filter((w) => w.status === STATUS.AKTUALNY).length;
    const rec = wiersze.filter((w) => w.status === STATUS.AKTUALNY).length;
    const pr = (x) => Math.round((x / pliki.length) * 100);
    const podsum = `CR ${cr}/${pliki.length} (${pr(cr)}%), recenzja kodu (CR ∪ audyt) ${rec}/${pliki.length} (${pr(rec)}%).`;
    if (a.ma("sucho")) {
      console.log(`SUCHO: nic nie zapisano do ${zapisz}. ${podsum}`);
      return 0;
    }
    writeFileSync(zapisz, md);
    console.log(`Zapisano ${zapisz}: ${podsum}`);
    return 0;
  }
  const podsumowanie = podsumujPokrycie(wiersze);
  const widoczne = filtrStatusu ? wiersze.filter((w) => filtrStatusu.includes(w.status)) : wiersze;

  if (a.ma("json")) {
    console.log(JSON.stringify({ tytul, pliki: widoczne.map(wierszDoJson), podsumowanie, nierozwiazane }, null, 2));
    return 0;
  }
  console.log(formatujPokrycie(widoczne, podsumowanie, { tytul, tabela: !a.ma("bez-tabeli") }));
  console.log(
    `\nŹródła: ${wpisyCr.length} wierszy REJESTR-CR, ${fale.length} fal REJESTR-ZNALEZISK, ` +
      `${mapa.size} plików z datą recenzji, ${prefiksy.length} obszarów.`
  );
  if (nierozwiazane.length) {
    console.log(`Nierozwiązane odwołania w rejestrach (${nierozwiazane.length}) — nie liczą się jako recenzja:`);
    for (const n of nierozwiazane.slice(0, 25)) console.log("  - " + n);
    if (nierozwiazane.length > 25) console.log(`  (+${nierozwiazane.length - 25} dalszych — pełna lista w --json)`);
  }
  return 0;
}

// ───────────────────────── wejście ─────────────────────────

const SPEC = {
  nazwaSkryptu: "cr-zakresy.mjs",
  opis: "menu kandydatów do CR z okna dni ALBO pokrycie kodu recenzją (--pokrycie); zero diffów",
  uzycie: [
    "node scripts/cr-zakresy.mjs --dni=1",
    "node scripts/cr-zakresy.mjs --od=2026-09-15 --do=2026-09-21",
    "node scripts/cr-zakresy.mjs --pokrycie",
    "node scripts/cr-zakresy.mjs --pokrycie --sciezka=<id-sciezki> --status=NIGDY,NIEAKTUALNY --json",
    "node scripts/cr-zakresy.mjs --pokrycie --zakres=origin/main...HEAD --status=NIGDY,NIEAKTUALNY",
    "node scripts/cr-zakresy.mjs --pokrycie --zapisz=POKRYCIE-CR.md [--sucho]"
  ],
  flagi: [
    { nazwa: "dni", wartosc: true, opis: "menu: ostatnie N dni (domyślnie 1 = dzisiaj)" },
    { nazwa: "dzien", wartosc: true, opis: "menu: jeden dzień RRRR-MM-DD" },
    { nazwa: "od", wartosc: true, opis: "menu: początek okna RRRR-MM-DD" },
    { nazwa: "do", wartosc: true, opis: "menu: koniec okna RRRR-MM-DD (domyślnie dziś)" },
    { nazwa: "pokrycie", opis: "tryb pokrycia: plik → ostatnia zmiana vs ostatni CR" },
    { nazwa: "sciezka", wartosc: true, opis: "pokrycie: prefiks katalogu ALBO ID ścieżek krytycznych z konfiguracji (np. P1,P4); domyślnie cr.katalogi_zrodel" },
    { nazwa: "zakres", wartosc: true, opis: "pokrycie: tylko pliki z `git diff --name-only <zakres>`" },
    { nazwa: "status", wartosc: true, opis: "pokrycie: filtr tabeli, np. NIGDY,NIEAKTUALNY (podsumowanie zawsze z całości)" },
    { nazwa: "zapisz", wartosc: true, opis: "pokrycie: zapisz raport markdown (jedyny zapis skryptu)" },
    { nazwa: "sucho", opis: "z --zapisz: policz i wypisz podsumowanie, NIE twórz pliku" },
    { nazwa: "bez-tabeli", opis: "pokrycie: tylko podsumowanie i domeny" },
    { nazwa: "json", opis: "wynik jako JSON" },
    { nazwa: "config", wartosc: true, opis: "plik konfiguracji (domyślnie .claude/projekt-heniek.json)" },
    { nazwa: "rejestr-cr", wartosc: true, opis: "nadpisuje cr.rejestr_cr" },
    { nazwa: "rejestr-znalezisk", wartosc: true, opis: "nadpisuje cr.rejestr_znalezisk" },
    { nazwa: "baza-1", wartosc: true, opis: "nadpisuje pierwszy ref z cr.baza_galezi" },
    { nazwa: "baza-2", wartosc: true, opis: "nadpisuje drugi ref z cr.baza_galezi" }
  ]
};

function glowna(argv) {
  const a = sparsujArgumenty(argv, SPEC);
  if (a.pomoc) {
    console.log(tekstPomocy(SPEC));
    return 0;
  }
  if (a.nieznane.length) {
    console.error(`cr-zakresy: nieznane argumenty: ${a.nieznane.join(" ")}\n\n${tekstPomocy(SPEC)}`);
    return 2;
  }
  if (!git(["rev-parse", "--git-dir"]).ok) {
    console.error("cr-zakresy: to nie jest repozytorium gita. NIC nie zostało zrobione.");
    return 2;
  }
  try {
    const cfg = wczytajKonfig(a.wartosc("config", ".claude/projekt-heniek.json"), a.ma("config"));
    const k = zbudujKontekst(cfg);
    return a.ma("pokrycie") ? pokrycie(a, cfg, k) : menu(a, cfg, k);
  } catch (e) {
    // fail-closed: każdy błąd (użycia, konfiguracji, rejestru, refu, nieoczekiwany) = kod 2, nic nie wypisane jako wynik
    console.error(`cr-zakresy: ${e.message}\nNIC nie zostało policzone (fail-closed).`);
    return 2;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  process.exitCode = glowna(process.argv.slice(2));
}
