#!/usr/bin/env node
/**
 * cr-bramka-zamkniecia.mjs — skryptowa bramka zamknięcia fali CR (RURA, zakres-cr).
 *
 * Bramka zamknięcia CR. Czyta sekcję `## Fala <id>` rejestru znalezisk
 * i porównuje ją z PRAWDZIWĄ historią gita. Parser rejestru CR i `wymieniaKlucz` biorę z
 * `cr-zakresy.mjs` (ten sam skill, jedna kopia kodu). Konfiguracja: `.claude/projekt-heniek.json`,
 * klucze `cr.rejestr_znalezisk` i `cr.rejestr_cr` (flagi `--rejestr`, `--rejestr-cr` nadpisują).
 *
 * Wywołanie:
 *   node scripts/cr-bramka-zamkniecia.mjs --fala=<id> --baza=<ref> --glowa=<ref> [--tabela]
 *
 * Sekcja fali (od `## Fala <id>` do następnego `## `) może mieć:
 *   - tabele znalezisk: kolumny `#`, `STAN` (albo `Status`), `SHA` (albo `SHA naprawy`),
 *     opcjonalnie `DOWÓD`, `PLIKI` i inne; kolejność dowolna, szukamy po nagłówku;
 *   - `### Commity bez znaleziska` — tabela z kolumną `SHA` (i powodem);
 *   - `### Pytania` (nagłówek zawierający „Pytania") — tabela z kolumną `Q`.
 *
 * STANY KOŃCOWE (kanon = ten słownik w pluginie): NAPRAWIONE | OBALONE | PYTANIE Qn | CZYSTO.
 * `POTWIERDZONE` świadomie nie istnieje (decyzja właściciela).
 *
 * Sprawdza:
 *   (a) STAN końcowy: NAPRAWIONE | OBALONE | PYTANIE Qn | CZYSTO — reszta to naruszenie;
 *   (b) SHA przy NAPRAWIONE istnieje i jest przodkiem --glowa; NAPRAWIONE bez SHA = naruszenie;
 *   (c) każdy commit nie-merge z baza..glowa jest przypisany (prefiks ≥7 znaków) do wiersza
 *       znaleziska albo do „Commity bez znaleziska" — WYJĄTEK: commit porządkowy, który zmienia
 *       WYŁĄCZNIE ślad CR (REJESTR-CR, `cr-pliki/*.txt` obok niego, `POKRYCIE-CR.md`, a także
 *       sam REJESTR-ZNALEZISK). Wyjątek patrzy na `--raw` (tryb + status): każdy wpis M albo A
 *       (pierwsze utworzenie), NOWY tryb 100644/100755, jedna ścieżka. Gitlink/symlink (160000,
 *       120000) i usunięcie (D) wyjątku nie dostają. Rename nie kwalifikuje: bez -M/-C git
 *       pokazuje go jako dwa wpisy (D + A). Link znalezisko↔commit WYŁĄCZNIE przez kolumnę SHA.
 *   (d) każde PYTANIE Qn ma Qn w tabeli pytań;
 *   (e) OBALONE ma niepusty DOWÓD (brak kolumny = naruszenie);
 *   (f) REJESTR-CR ma wiersz z kluczem `Fala <id>` w kolumnie Zakres. Brak wiersza = naruszenie;
 *   (g) CZYSTO ma niepusty opis w kolumnie „OPIS SPRAWDZENIA” (albo „OPIS”/„SPRAWDZENIE”); brak = naruszenie;
 *   (h) limit rund 1+1: opcjonalna kolumna „Rundy” w REJESTR-CR; wartość > 2 bez „wyjątek: …” w tej
 *       samej komórce = naruszenie (wiersze tej fali). Brak kolumny = brak kontroli.
 *
 * Kody wyjścia:
 *   0 = zero naruszeń (ZIELONA);
 *   1 = są naruszenia (CZERWONA);
 *   2 = błąd użycia, zły ref, brak albo nieczytelny rejestr (REJESTR-ZNALEZISK i REJESTR-CR),
 *       brak sekcji fali, zły config — fail-closed: bramka NIE przepuszcza zielonego.
 * Bramka nic nie zapisuje. `--sucho` jest przyjmowane dla spójności z `cr-zakresy.mjs` i nie zmienia wyniku.
 *
 * Świadomie, na prośbę właściciela: brak lub nieczytelny REJESTR-CR
 * daje kod 2 (wcześniej 1). Brak WIERSZA fali w REJESTR-CR nadal daje naruszenie (kod 1).
 */
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, realpathSync } from "node:fs";
import { isAbsolute, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import {
  BladRejestru,
  BladUzycia,
  sparsujArgumenty,
  sparsujRejestrCr,
  tekstPomocy,
  wczytajKonfig,
  wymagane,
  wymieniaKlucz
} from "./cr-zakresy.mjs";

const SPEC = {
  nazwaSkryptu: "cr-bramka-zamkniecia.mjs",
  opis: "bramka zamknięcia fali CR: rejestr znalezisk kontra historia gita",
  uzycie: [
    "node scripts/cr-bramka-zamkniecia.mjs --fala=<id> --baza=origin/main --glowa=HEAD",
    "node scripts/cr-bramka-zamkniecia.mjs --fala=<id> --baza=origin/main --glowa=HEAD --tabela"
  ],
  flagi: [
    { nazwa: "fala", wartosc: true, opis: "id fali — nagłówek `## Fala <id>` w rejestrze" },
    { nazwa: "baza", wartosc: true, opis: "ref bazy zakresu commitów (baza..glowa)" },
    { nazwa: "glowa", wartosc: true, opis: "ref głowy zakresu (gałąź PR-a)" },
    { nazwa: "rejestr", wartosc: true, opis: "ścieżka rejestru znalezisk (domyślnie cr.rejestr_znalezisk z konfiguracji)" },
    { nazwa: "rejestr-w-repo", wartosc: true, opis: "ścieżka rejestru W REPOZYTORIUM do porównania z commitami (domyślnie = --rejestr)" },
    { nazwa: "rejestr-cr", wartosc: true, opis: "REJESTR-CR z wierszem `Fala <id>` (domyślnie cr.rejestr_cr)" },
    { nazwa: "tabela", opis: "wypisz markdown „rejestr poprawek” commit↔znaleziska" },
    { nazwa: "sucho", opis: "przyjmowane dla spójności; bramka i tak nic nie zapisuje" },
    { nazwa: "config", wartosc: true, opis: "plik konfiguracji (domyślnie .claude/projekt-heniek.json)" }
  ]
};

const MIN_PREFIKS = 7;
const WZOR_SHA = /\b[0-9a-f]{7,40}\b/gi;
const TRYBY_PLIKU_ZWYKLEGO = new Set(["100644", "100755"]);

// ————————————————— pomocnicze: git —————————————————

function git(args, { input } = {}) {
  const r = spawnSync("git", args, { encoding: "utf8", input });
  return { kod: r.status, out: (r.stdout || "").trim(), err: (r.stderr || "").trim() };
}

function rozwiazRef(ref) {
  const r = git(["rev-parse", "--verify", "--quiet", `${ref}^{commit}`]);
  return r.kod === 0 ? r.out : null;
}

function korzenRepo() {
  const r = git(["rev-parse", "--show-toplevel"]);
  return r.kod === 0 ? r.out : null;
}

/** Ujednolica separatory (Windows daje `\`) i usuwa wiodące `./`. */
function znormalizujSciezke(p) {
  return p.replace(/\\/g, "/").replace(/^\.\//, "");
}

/**
 * Ścieżka widziana WZGLĘDEM korzenia repo (tak jak `git diff-tree`). Względną traktujemy jako
 * już-repo-relative. Bezwzględną sprowadzamy do korzenia; `realpathSync.native` wyrównuje formy
 * Windows (8.3 `OLEKIA~1` vs pełna nazwa z `git rev-parse`).
 */
function sciezkaWzgledemRepo(p, korzen) {
  if (!isAbsolute(p)) return znormalizujSciezke(p);
  if (!korzen) return znormalizujSciezke(p);
  try {
    const realKorzen = realpathSync.native(korzen);
    const realP = realpathSync.native(resolve(p));
    return znormalizujSciezke(relative(realKorzen, realP));
  } catch {
    return znormalizujSciezke(relative(korzen, resolve(p)));
  }
}

/** Wpisy zmian commita przez `--raw` (tryb stary/nowy + status). Null przy błędzie gita. */
function wpisyCommita(sha) {
  const r = git(["diff-tree", "--no-commit-id", "-r", "--root", "--raw", sha]);
  if (r.kod !== 0) return null;
  if (!r.out) return [];
  return r.out
    .split(/\r?\n/)
    .filter(Boolean)
    .map((linia) => {
      // `:<tryb-stary> <tryb-nowy> <sha-stary> <sha-nowy> <status>[score]\t<ścieżka>[\t<ścieżka-nowa>]`
      const m = linia.match(/^:(\d{6})\s+(\d{6})\s+[0-9a-f]+\.*\s+[0-9a-f]+\.*\s+([A-Z])\d*\t(.+)$/);
      if (!m) return null;
      const [, trybStary, trybNowy, status, reszta] = m;
      return { trybStary, trybNowy, status, sciezki: reszta.split("\t").map(znormalizujSciezke) };
    })
    .filter(Boolean);
}

/** Ślad CR: REJESTR-CR, `cr-pliki/*.txt` w jego katalogu (bez podkatalogów), `POKRYCIE-CR.md` obok. */
function czySladCr(p, sciezkaRejestruCr) {
  const katalog = sciezkaRejestruCr.includes("/") ? sciezkaRejestruCr.slice(0, sciezkaRejestruCr.lastIndexOf("/") + 1) : "";
  if (p === sciezkaRejestruCr || p === `${katalog}POKRYCIE-CR.md`) return true;
  const reszta = p.startsWith(`${katalog}cr-pliki/`) ? p.slice(`${katalog}cr-pliki/`.length) : null;
  return reszta !== null && /^[\w.-]+\.txt$/.test(reszta);
}

/**
 * Czy commit zmienia WYŁĄCZNIE rejestr (albo ślad CR) w sposób kwalifikujący do wyjątku (c):
 * każdy wpis M albo A, nowy tryb zwykłego pliku, jedna ścieżka równa rejestrowi (albo śladowi CR).
 */
export function czyCommitTylkoRejestru(wpisy, sciezkaRejestru, sladCr = null) {
  if (wpisy === null || wpisy.length === 0) return false;
  if (!sladCr && wpisy.length !== 1) return false;
  return wpisy.every((w) => {
    if (w.status !== "M" && w.status !== "A") return false;
    if (!TRYBY_PLIKU_ZWYKLEGO.has(w.trybNowy)) return false;
    if (w.sciezki.length !== 1) return false;
    const p = w.sciezki[0];
    return p === sciezkaRejestru || (sladCr !== null && czySladCr(p, sladCr));
  });
}

// ————————————————— pomocnicze: markdown —————————————————

/** Komórka bez znaczników formatowania. */
function oczysc(komorka) {
  return (komorka ?? "").replace(/[`*]/g, "").trim();
}

function czyPusta(komorka) {
  const c = oczysc(komorka);
  return c === "" || /^[—–-]+$/.test(c);
}

function podzielWiersz(linia) {
  let s = linia.trim();
  if (s.startsWith("|")) s = s.slice(1);
  if (s.endsWith("|")) s = s.slice(0, -1);
  // `\|` w komórce to dosłowna kreska, nie granica kolumny
  return s.split(/(?<!\\)\|/).map((c) => c.replace(/\\\|/g, "|").trim());
}

function normalizujNaglowek(n) {
  return oczysc(n).toUpperCase();
}

/** Indeks kolumny po nazwie (dokładnie albo prefiks, np. `SHA naprawy`). */
function kolumna(naglowki, ...nazwy) {
  const norm = naglowki.map(normalizujNaglowek);
  for (const nazwa of nazwy) {
    const i = norm.indexOf(nazwa);
    if (i >= 0) return i;
  }
  for (const nazwa of nazwy) {
    const i = norm.findIndex((n) => n.startsWith(nazwa + " "));
    if (i >= 0) return i;
  }
  return -1;
}

/**
 * Wycina sekcję `## Fala <id>` (do następnego `## `). Null gdy brak. Id musi kończyć się
 * na końcu linii albo przed spacją — `Fala 23.09` nie łapie `Fala 23.09.2026`.
 */
export function wytnijSekcjeFali(tekst, id) {
  const linie = tekst.split(/\r?\n/);
  const esc = id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const wzor = new RegExp(`^##\\s+Fala\\s+${esc}(\\s|$)`);
  const start = linie.findIndex((l) => wzor.test(l));
  if (start < 0) return null;
  let koniec = linie.length;
  for (let i = start + 1; i < linie.length; i++) {
    if (/^##\s/.test(linie[i])) {
      koniec = i;
      break;
    }
  }
  return linie.slice(start + 1, koniec);
}

/** Tabele w sekcji z informacją, pod którym nagłówkiem `###` stoją. */
export function wytnijTabele(linieSekcji) {
  const tabele = [];
  let podsekcja = "";
  let biezaca = null;
  for (const linia of linieSekcji) {
    const mNag = linia.match(/^###\s+(.*)$/);
    if (mNag) {
      podsekcja = mNag[1].trim();
      biezaca = null;
      continue;
    }
    if (linia.trim().startsWith("|")) {
      if (!biezaca) {
        biezaca = { podsekcja, linie: [] };
        tabele.push(biezaca);
      }
      biezaca.linie.push(linia);
    } else {
      biezaca = null;
    }
  }
  return tabele
    .filter((t) => t.linie.length >= 2 && /^\|?\s*:?-{3,}/.test(t.linie[1].trim()))
    .map((t) => ({
      podsekcja: t.podsekcja,
      naglowki: podzielWiersz(t.linie[0]),
      wiersze: t.linie.slice(2).map(podzielWiersz)
    }));
}

export function wyciagnijSha(komorka) {
  return [...oczysc(komorka).matchAll(WZOR_SHA)].map((m) => m[0].toLowerCase());
}

/** Parsuje sekcję fali: znaleziska, commity bez znaleziska, pytania. */
export function sparsujSekcjeFali(linieSekcji) {
  const znaleziska = [];
  const bezZnaleziska = [];
  const pytania = new Set();
  let tabelPytan = 0;

  for (const t of wytnijTabele(linieSekcji)) {
    const pod = t.podsekcja.toLowerCase();
    if (pod.includes("commity bez znaleziska")) {
      const iSha = kolumna(t.naglowki, "SHA");
      if (iSha < 0) continue;
      for (const w of t.wiersze) {
        for (const sha of wyciagnijSha(w[iSha])) {
          bezZnaleziska.push({ sha, powod: w.filter((_, i) => i !== iSha).map(oczysc).join(" ") });
        }
      }
      continue;
    }
    if (pod.includes("pytania")) {
      const iQ = kolumna(t.naglowki, "Q");
      if (iQ < 0) continue;
      tabelPytan++;
      for (const w of t.wiersze) {
        const q = oczysc(w[iQ]).toUpperCase();
        if (/^Q\d+$/.test(q)) pytania.add(q);
      }
      continue;
    }
    const iId = kolumna(t.naglowki, "#");
    const iStan = kolumna(t.naglowki, "STAN", "STATUS");
    const iSha = kolumna(t.naglowki, "SHA");
    if (iId < 0 || iStan < 0 || iSha < 0) continue; // nie tabela znalezisk
    const iDowod = kolumna(t.naglowki, "DOWÓD", "DOWOD");
    const iOpis = kolumna(t.naglowki, "OPIS SPRAWDZENIA", "OPIS", "SPRAWDZENIE");
    for (const w of t.wiersze) {
      znaleziska.push({
        id: oczysc(w[iId]),
        stan: oczysc(w[iStan]),
        sha: wyciagnijSha(w[iSha]),
        dowod: iDowod >= 0 ? w[iDowod] : undefined,
        maKolumneDowodu: iDowod >= 0,
        opis: iOpis >= 0 ? w[iOpis] : undefined,
        maKolumneOpisu: iOpis >= 0
      });
    }
  }
  return { znaleziska, bezZnaleziska, pytania, tabelPytan };
}

/**
 * Limit rund 1+1 (decyzja Q7): kolumna „Rundy” jest opcjonalna. Wartość > 2 wymaga wpisu wyjątku
 * w TEJ SAMEJ komórce („3 (wyjątek: decyzja właściciela)”). Zwraca opis naruszenia albo null.
 */
export function naruszenieRund(komorka) {
  if (komorka === null || czyPusta(komorka)) return null;
  const m = oczysc(komorka).match(/^(\d+)/);
  if (!m) return `kolumna Rundy: „${oczysc(komorka)}” nie zaczyna się liczbą`;
  if (Number(m[1]) <= 2) return null;
  // reguła właściciela z 10.11: dokładnie jedno dodatkowe CR końcowe linii, wpis „3 (CR końcowe, reguła 10.11)”; inne wartości > 2 dalej wymagają wyjątku
  if (Number(m[1]) === 3 && /^3\s*\(\s*CR końcowe\s*,\s*reguła 10\.11\s*\)\s*$/i.test(oczysc(komorka))) return null;
  return /wyjątek\s*[:-]?\s*\S/i.test(komorka) ? null : `rund ${m[1]} > 2 bez wpisu wyjątku w komórce Rundy`;
}

/** Stan końcowy: `{rodzaj}` albo `{rodzaj: "PYTANIE", q}`; null dla stanu niekońcowego. */
export function stanKoncowy(stan) {
  const s = stan.trim().toUpperCase();
  if (s === "NAPRAWIONE" || s === "OBALONE" || s === "CZYSTO") return { rodzaj: s };
  const m = s.match(/^PYTANIE\s+(Q\d+)$/);
  if (m) return { rodzaj: "PYTANIE", q: m[1] };
  return null;
}

function pasuje(prefiks, pelny) {
  return prefiks.length >= MIN_PREFIKS && pelny.startsWith(prefiks);
}

// ————————————————— główna logika —————————————————

function glowna(argv) {
  const a = sparsujArgumenty(argv, SPEC);
  if (a.pomoc) {
    console.log(tekstPomocy(SPEC));
    return 0;
  }
  if (a.nieznane.length) {
    console.error(`BŁĄD UŻYCIA: nieznane argumenty: ${a.nieznane.join(" ")}\n\n${tekstPomocy(SPEC)}`);
    return 2;
  }

  const fala = a.wartosc("fala", "");
  const baza = a.wartosc("baza", "");
  const glowa = a.wartosc("glowa", "");
  const brak = [["fala", fala], ["baza", baza], ["glowa", glowa]].filter(([, v]) => !v).map(([n]) => `--${n}`);
  if (brak.length) {
    console.error(`BŁĄD UŻYCIA: brak wymaganych flag: ${brak.join(", ")}\n\n${tekstPomocy(SPEC)}`);
    return 2;
  }

  const cfg = wczytajKonfig(a.wartosc("config", ".claude/projekt-heniek.json"), a.ma("config"));
  const sciezka = wymagane(a.wartosc("rejestr", cfg.cr.rejestr_znalezisk), "rejestr_znalezisk");
  const sciezkaWRepoRaw = a.wartosc("rejestr-w-repo", sciezka);
  const sciezkaCr = wymagane(a.wartosc("rejestr-cr", cfg.cr.rejestr_cr), "rejestr_cr");

  if (!existsSync(sciezka)) {
    console.error(`BŁĄD UŻYCIA: brak rejestru znalezisk: ${sciezka} (fail-closed)`);
    return 2;
  }
  const shaBazy = rozwiazRef(baza);
  if (!shaBazy) {
    console.error(`BŁĄD UŻYCIA: zły ref --baza=${baza} (nie wskazuje commita)`);
    return 2;
  }
  const shaGlowy = rozwiazRef(glowa);
  if (!shaGlowy) {
    console.error(`BŁĄD UŻYCIA: zły ref --glowa=${glowa} (nie wskazuje commita)`);
    return 2;
  }
  const korzen = korzenRepo();
  const sciezkaWRepo = sciezkaWzgledemRepo(sciezkaWRepoRaw, korzen);
  const sciezkaCrWRepo = sciezkaWzgledemRepo(sciezkaCr, korzen);

  const linie = wytnijSekcjeFali(readFileSync(sciezka, "utf8"), fala);
  if (!linie) {
    console.error(`BŁĄD UŻYCIA: w ${sciezka} nie ma sekcji „## Fala ${fala}". Bramka NIE przechodzi (fail-closed).`);
    return 2;
  }
  const f = sparsujSekcjeFali(linie);
  if (!f.znaleziska.length) {
    console.error(`BŁĄD UŻYCIA: sekcja „## Fala ${fala}" nie ma tabeli znalezisk (kolumny #, STAN, SHA). Fail-closed.`);
    return 2;
  }

  // REJESTR-CR: brak albo nieczytelny = kod 2 (zasada właściciela: nieczytelny rejestr to brak pomiaru)
  if (!existsSync(sciezkaCr)) {
    console.error(`BŁĄD UŻYCIA: brak REJESTR-CR: ${sciezkaCr} — fala bez śladu w centralnym rejestrze recenzji (fail-closed)`);
    return 2;
  }
  let wpisyCr;
  try {
    wpisyCr = sparsujRejestrCr(readFileSync(sciezkaCr, "utf8"));
  } catch (e) {
    console.error(`BŁĄD UŻYCIA: REJESTR-CR nieczytelny (${e.message.split(/\r?\n/)[0]}) — fail-closed`);
    return 2;
  }

  const naruszenia = [];

  // (f) wiersz fali w REJESTR-CR
  const klucz = `Fala ${fala}`;
  if (!wpisyCr.some((w) => wymieniaKlucz(w.zakres, klucz))) {
    naruszenia.push(`(f) REJESTR-CR nie ma wiersza z „${klucz}" w kolumnie Zakres — dopisz wiersz + cr-pliki/<data>-<id>.txt + POKRYCIE-CR [${sciezkaCr}]`);
  }
  // (h) limit rund 1+1 — tylko wiersze tej fali, tylko gdy rejestr ma kolumnę Rundy
  for (const w of wpisyCr.filter((x) => wymieniaKlucz(x.zakres, klucz))) {
    const n = naruszenieRund(w.rundy);
    if (n) naruszenia.push(`(h) REJESTR-CR ${w.data} (linia ${w.linia}): ${n}`);
  }

  // (a), (b), (d), (e) — wiersz po wierszu
  for (const z of f.znaleziska) {
    const etyk = z.id || "(bez ID)";
    const k = stanKoncowy(z.stan);
    if (!k) {
      naruszenia.push(`(a) ${etyk}: stan „${z.stan || "(pusty)"}" nie jest końcowy — dozwolone: NAPRAWIONE, OBALONE, PYTANIE Qn, CZYSTO`);
      continue;
    }
    if (k.rodzaj === "NAPRAWIONE") {
      if (!z.sha.length) naruszenia.push(`(b) ${etyk}: NAPRAWIONE bez SHA`);
      for (const sha of z.sha) {
        if (git(["cat-file", "-e", `${sha}^{commit}`]).kod !== 0) {
          naruszenia.push(`(b) ${etyk}: SHA ${sha} nie istnieje w repozytorium`);
        } else if (git(["merge-base", "--is-ancestor", sha, shaGlowy]).kod !== 0) {
          naruszenia.push(`(b) ${etyk}: SHA ${sha} nie jest przodkiem głowy ${glowa}`);
        }
      }
    }
    if (k.rodzaj === "PYTANIE" && !f.pytania.has(k.q)) {
      naruszenia.push(`(d) ${etyk}: ${k.q} nie ma wiersza w tabeli „### Pytania"`);
    }
    if (k.rodzaj === "OBALONE") {
      if (!z.maKolumneDowodu) naruszenia.push(`(e) ${etyk}: OBALONE, a tabela nie ma kolumny DOWÓD`);
      else if (czyPusta(z.dowod)) naruszenia.push(`(e) ${etyk}: OBALONE z pustym DOWÓD`);
    }
    // (g) CZYSTO bez opisu sprawdzenia = naruszenie (decyzja Q1): „czysto” musi mówić, CO sprawdzono
    if (k.rodzaj === "CZYSTO" && (!z.maKolumneOpisu || czyPusta(z.opis))) {
      naruszenia.push(`(g) ${etyk}: CZYSTO bez niepustego opisu sprawdzenia (kolumna „OPIS SPRAWDZENIA”)`);
    }
  }

  // (c) — każdy commit zakresu przypisany albo commit porządkowy
  const zakres = git(["rev-list", "--no-merges", "--reverse", `${shaBazy}..${shaGlowy}`]);
  if (zakres.kod !== 0) {
    console.error(`BŁĄD UŻYCIA: git rev-list padł: ${zakres.err}`);
    return 2;
  }
  const commity = zakres.out ? zakres.out.split(/\r?\n/) : [];
  const przypisanie = new Map();
  for (const c of commity) {
    const ids = f.znaleziska.filter((z) => z.sha.some((s) => pasuje(s, c))).map((z) => z.id);
    const bez = f.bezZnaleziska.find((b) => pasuje(b.sha, c));
    const wpisy = wpisyCommita(c);
    const czyRejestrOnly = czyCommitTylkoRejestru(wpisy, sciezkaWRepo, sciezkaCrWRepo);
    przypisanie.set(c, { ids, bez, czyRejestrOnly });
    if (!ids.length && !bez && !czyRejestrOnly) {
      const temat = git(["show", "-s", "--format=%s", c]).out;
      naruszenia.push(`(c) commit ${c.slice(0, 9)} nieprzypisany — ani wiersz znaleziska, ani „Commity bez znaleziska" („${temat}")`);
    }
  }

  if (a.ma("tabela")) {
    const out = ["| commit | data | pliki | znaleziska |", "|---|---|---|---|"];
    for (const c of commity) {
      const data = git(["show", "-s", "--format=%cs", c]).out;
      const pliki = git(["show", "--name-only", "--format=", c]).out.split(/\r?\n/).filter(Boolean);
      const { ids, bez, czyRejestrOnly } = przypisanie.get(c);
      const zn = ids.length
        ? ids.join(", ")
        : bez
          ? `— (bez znaleziska: ${bez.powod || "brak powodu"})`
          : czyRejestrOnly
            ? "(commit rejestru — auto)"
            : "⛔ NIEPRZYPISANY";
      out.push(`| \`${c.slice(0, 9)}\` | ${data} | ${pliki.map((p) => `\`${p}\``).join("<br>")} | ${zn} |`);
    }
    console.log(out.join("\n"));
    console.log("");
  }

  console.log(`Fala ${fala}: znalezisk ${f.znaleziska.length}, commitów w ${baza}..${glowa}: ${commity.length}, pytań: ${f.pytania.size}`);
  if (!naruszenia.length) {
    console.log("BRAMKA ZAMKNIĘCIA: ZIELONA — zero naruszeń.");
    return 0;
  }
  console.log(`BRAMKA ZAMKNIĘCIA: CZERWONA — naruszeń: ${naruszenia.length}`);
  for (const n of naruszenia) console.log(`  - ${n}`);
  return 1;
}

/** Wejście z kontrolą błędów: każdy wyjątek = kod 2 (fail-closed), nigdy zielone po błędzie. */
export function uruchom(argv) {
  try {
    return glowna(argv);
  } catch (e) {
    if (e instanceof BladRejestru || e instanceof BladUzycia || e instanceof TypeError || e?.name === "BladKonfiguracji") {
      console.error(`cr-bramka-zamkniecia: ${e.message}\nNIC nie zostało sprawdzone (fail-closed).`);
    } else {
      console.error(`cr-bramka-zamkniecia: nieoczekiwany błąd: ${e?.message ?? e}\nNIC nie zostało sprawdzone (fail-closed).`);
    }
    return 2;
  }
}

// Uruchamiaj tylko wywołany wprost — import (np. z testu) nie odpala bramki.
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  process.exitCode = uruchom(process.argv.slice(2));
}
