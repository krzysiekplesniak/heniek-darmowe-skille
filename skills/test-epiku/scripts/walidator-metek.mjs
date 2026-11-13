#!/usr/bin/env node
// walidator-metek.mjs - pilnuje zmian METEK stanu w plikach .feature względem bazy gita.
// Użycie:
//   node walidator-metek.mjs --baza=<ref> [--glowa=<ref>] [--repo=<katalog>] [--dowod-testu=<sciezka-lub-sha>]... [--parser=<gherkin.mjs>] [--sucho]
//   node walidator-metek.mjs --wejscie=<plik.json|-> [flagi nadpisują pola z JSON]
//   JSON: {"baza": "...", "glowa": "HEAD", "repo": "...", "dowody": ["..."] lub "...", "parser": "..."}
// Zakres: pliki .feature zmienione w baza...glowa. Stan porównywany z merge-base (jak `git diff baza...glowa`).
// Scenariusz łączony po nazwie (zmiana nazwy = usunięcie + nowy scenariusz).
// Reguły:
//   a) wejście w @jest lub @na-galezi (z @planowane, z innego stanu albo jako nowy scenariusz) wymaga dowodu
//      (--dowod-testu). Bez ważnego dowodu = 1.
//   b) obniżenie stanu (ranga: @jest 3 > @na-galezi 2 > pozostałe stany 1 > brak 0), usunięcie metki stanu
//      i usunięcie scenariusza z metką stanu = 4 (decyzja właściciela).
//   c) nowy scenariusz bez metki stanu = 1.
//   d) nowa metka spoza listy dozwolonej (metki stanu, @podroz, @rola:*) = 1.
//   e) brak gita, zły ref, brak bazy, brak parsera, zła flaga = 2 (nigdy zielone).
// Kody: 0 zielono, 1 naruszenie (plik:linia), 2 brak pomiaru, 4 stop na decyzję właściciela.
// Priorytet przy mieszance: 1 > 4 > 2 > 0.
// Wyjście: JSON na stdout zawsze {krok, kod, wynik, niesprawdzone, ...}.
// Skrypt nic nie zapisuje. --sucho jest tylko znacznikiem w raporcie (tryb podglądu: zero zapisów, kody bez zmian).
// Parser kroków: lokalna kopia scripts/lib/gherkin.mjs (ta sama co w lint-scenariuszy.mjs; parytet pilnuje
// parser-parytet.test.mjs). Inny parser podasz przez --parser=<ścieżka>.
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";

const TU = path.dirname(fileURLToPath(import.meta.url));
export const PARSER_DOMYSLNY = path.resolve(TU, "lib/gherkin.mjs");

export const KOD = { ZIELONO: 0, NARUSZENIE: 1, BRAK_POMIARU: 2, DECYZJA: 4 };
const WYNIK = { 0: "CZYSTO", 1: "NARUSZENIE", 2: "BRAK POMIARU", 4: "DECYZJA WŁAŚCICIELA" };

// Metki stanu: jeden stan na scenariusz. @podroz i @rola:* nie są stanem.
export const METKI_STANU = ["@jest", "@na-galezi", "@planowane", "@todo", "@brak", "@decyzja", "@zasada", "@pokaz", "@propozycja"];
const DOBRE_STANY = ["@jest", "@na-galezi"];
const RANGA = { "@jest": 3, "@na-galezi": 2 };
export const METKI_DOZWOLONE = [...METKI_STANU, "@podroz"];

export function metkaDozwolona(m) {
  return METKI_DOZWOLONE.includes(m) || /^@rola:\S+$/u.test(m);
}

const ranga = (stan) => (stan === null ? 0 : (RANGA[stan] ?? 1));
const stanyZ = (metki) => metki.filter((m) => METKI_STANU.includes(m));
const pierwszaLinia = (e) => String(e?.message ?? e).split("\n")[0];
const linieZBledu = (msg) => {
  const m = String(msg).match(/:(\d+) - /);
  return m ? Number(m[1]) : 1;
};

function git(repo, args) {
  return execFileSync("git", ["-C", repo, "-c", "core.quotepath=off", ...args], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    maxBuffer: 64 * 1024 * 1024,
  });
}

function gitOrNull(repo, args) {
  try {
    return git(repo, args);
  } catch {
    return null;
  }
}

/** Treść pliku w danym refie albo null, gdy go tam nie ma. */
function plikWRefie(repo, ref, plik) {
  return gitOrNull(repo, ["show", `${ref}:${plik}`]);
}

/** Dowód ważny = istniejący commit (sha) albo istniejący plik (ścieżka względem repo lub absolutna). Treści nie czytamy. */
export function dowodWazny(repo, dowod) {
  if (!dowod) return false;
  if (/^[0-9a-f]{7,40}$/iu.test(dowod) && gitOrNull(repo, ["cat-file", "-e", `${dowod}^{commit}`]) !== null) return true;
  const p = path.isAbsolute(dowod) ? dowod : path.resolve(repo, dowod);
  try {
    return fs.statSync(p).isFile();
  } catch {
    return false;
  }
}

const mapaScenariuszy = (funkcja) => new Map((funkcja?.scenariusze ?? []).map((s) => [s.nazwa, s]));

/**
 * Główna analiza. Rzuca przy błędzie git (wywołujący zamienia to na kod 2).
 * @returns {{naruszenia, decyzje, brakPomiaru: string[], pliki: number, scenariusze: number}}
 */
export function analizuj({ repo, baza, glowa, dowody, parsuj }) {
  const mergeBase = git(repo, ["merge-base", baza, glowa]).trim();
  const dowodOk = dowody.some((d) => dowodWazny(repo, d));
  const zmienione = git(repo, ["diff", "--name-only", "--no-renames", `${baza}...${glowa}`])
    .split(/\r?\n/)
    .filter((p) => p.endsWith(".feature"));

  const naruszenia = [];
  const decyzje = [];
  const brakPomiaru = [];
  let scenariusze = 0;
  const N = (plik, linia, typ, opis) => naruszenia.push({ plik, linia, typ, opis });
  const D = (plik, linia, typ, opis) => decyzje.push({ plik, linia, typ, opis });
  const DOWOD = "(wymagany dowód: --dowod-testu)";

  for (const plik of zmienione) {
    const bTresc = plikWRefie(repo, mergeBase, plik);
    const hTresc = plikWRefie(repo, glowa, plik);
    let b = null;
    let h = null;
    if (bTresc !== null) {
      try {
        b = parsuj(bTresc, plik);
      } catch (e) {
        brakPomiaru.push(`baza nie daje się sparsować, nie porównuję: ${plik}: ${pierwszaLinia(e)}`);
        continue;
      }
    }
    if (hTresc !== null) {
      try {
        h = parsuj(hTresc, plik);
      } catch (e) {
        N(plik, linieZBledu(e.message), "parser", pierwszaLinia(e));
        continue;
      }
    }

    // Metki na poziomie funkcji: nowe metki spoza listy = 1; nowa metka stanu na funkcji omijałaby reguły = 1.
    const metkiFunkcjiBazy = b?.metki ?? [];
    for (const m of h?.metki ?? []) {
      if (metkiFunkcjiBazy.includes(m)) continue;
      if (METKI_STANU.includes(m)) N(plik, 1, "stan_na_funkcji", `metka stanu "${m}" na poziomie funkcji omija reguły scenariuszy`);
      else if (!metkaDozwolona(m)) N(plik, 1, "metka_spoza_listy", `nowa metka "${m}" na poziomie funkcji spoza listy dozwolonej`);
    }

    const bMapa = mapaScenariuszy(b);
    const hNazwy = new Set();
    for (const s of h?.scenariusze ?? []) {
      scenariusze++;
      if (hNazwy.has(s.nazwa)) N(plik, s.linia, "zduplikowana_nazwa", `dwa scenariusze o nazwie "${s.nazwa}"`);
      hNazwy.add(s.nazwa);

      const bS = bMapa.get(s.nazwa) ?? null;
      const bMetki = bS?.metki ?? [];
      for (const m of s.metki) {
        if (!bMetki.includes(m) && !metkaDozwolona(m)) N(plik, s.linia, "metka_spoza_listy", `nowa metka "${m}" w "${s.nazwa}" spoza listy dozwolonej`);
      }

      const hs = stanyZ(s.metki);
      if (hs.length > 1) N(plik, s.linia, "wiele_metek_stanu", `scenariusz "${s.nazwa}" ma więcej niż jedną metkę stanu: ${hs.join(" ")}`);
      const hStan = hs[0] ?? null;

      if (!bS) {
        // Reguła c: nowy scenariusz bez metki stanu. Reguła a dla nowego scenariusza z dobrym stanem.
        if (hStan === null) N(plik, s.linia, "nowy_bez_metki_stanu", `nowy scenariusz "${s.nazwa}" bez metki stanu`);
        else if (DOBRE_STANY.includes(hStan) && !dowodOk) N(plik, s.linia, "nowy_bez_dowodu", `nowy scenariusz "${s.nazwa}" z ${hStan} ${DOWOD}`);
        continue;
      }

      const bStan = stanyZ(bS.metki)[0] ?? null;
      if (bStan === hStan) continue;
      if (hStan === null) {
        D(plik, s.linia, "usunieta_metka_stanu", `scenariusz "${s.nazwa}": ${bStan} -> brak metki stanu`);
      } else if (ranga(hStan) < ranga(bStan)) {
        D(plik, s.linia, "obnizenie_stanu", `scenariusz "${s.nazwa}": ${bStan} -> ${hStan}`);
      } else if (DOBRE_STANY.includes(hStan) && !dowodOk) {
        N(plik, s.linia, "awans_bez_dowodu", `scenariusz "${s.nazwa}": ${bStan ?? "brak"} -> ${hStan} ${DOWOD}`);
      }
    }

    // Scenariusze z bazy, których nie ma w głowie (także całe usunięte pliki): usunięcie stanu = decyzja.
    for (const [nazwa, bS] of bMapa) {
      if (hNazwy.has(nazwa)) continue;
      const bStan = stanyZ(bS.metki)[0] ?? null;
      if (bStan !== null) D(plik, bS.linia, "usuniety_scenariusz_ze_stanem", `usunięty scenariusz "${nazwa}" z metką ${bStan}`);
    }
  }
  return { naruszenia, decyzje, brakPomiaru, pliki: zmienione.length, scenariusze };
}

function raportuj(kontekst, kod, niesprawdzone) {
  const wynik = { krok: "walidator-metek", kod, wynik: WYNIK[kod], niesprawdzone, ...kontekst };
  process.stdout.write(JSON.stringify(wynik, null, 2) + "\n");
  return kod;
}

/** Wejście: plik JSON albo "-" (stdin). Zwraca obiekt albo rzuca. */
function wczytajJson(wejscie) {
  const tresc = wejscie === "-" ? fs.readFileSync(0, "utf8") : fs.readFileSync(path.resolve(wejscie), "utf8");
  const obj = JSON.parse(tresc);
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) throw new Error("JSON wejścia musi być obiektem");
  return obj;
}

export async function main(argv) {
  const flagi = { baza: null, glowa: null, repo: null, parser: null, sucho: false, dowody: [], wejscie: null };
  const zleArgumenty = [];
  for (const a of argv) {
    if (a.startsWith("--baza=")) flagi.baza = a.slice(7);
    else if (a.startsWith("--glowa=")) flagi.glowa = a.slice(8);
    else if (a.startsWith("--repo=")) flagi.repo = a.slice(7);
    else if (a.startsWith("--parser=")) flagi.parser = a.slice(9);
    else if (a.startsWith("--dowod-testu=")) flagi.dowody.push(...a.slice(14).split(",").map((s) => s.trim()).filter(Boolean));
    else if (a.startsWith("--wejscie=")) flagi.wejscie = a.slice(10);
    else if (a === "--sucho") flagi.sucho = true;
    else zleArgumenty.push(`zły argument: ${a}`);
  }

  const kontekst = { baza: null, glowa: null, sucho: flagi.sucho, pliki_feature: 0, scenariusze: 0, naruszenia: [], decyzje: [], dowody: [] };
  if (zleArgumenty.length) {
    process.stderr.write(`${zleArgumenty.join("\n")}\nużycie: walidator-metek.mjs --baza=<ref> [--glowa=<ref>] [--repo=<dir>] [--dowod-testu=<x>] [--parser=<gherkin.mjs>] [--wejscie=<json>] [--sucho]\n`);
    return raportuj(kontekst, KOD.BRAK_POMIARU, zleArgumenty);
  }

  let json = {};
  if (flagi.wejscie !== null) {
    try {
      json = wczytajJson(flagi.wejscie);
    } catch (e) {
      return raportuj(kontekst, KOD.BRAK_POMIARU, [`nie udało się wczytać wejścia JSON: ${pierwszaLinia(e)}`]);
    }
  }

  const baza = flagi.baza ?? json.baza ?? null;
  const glowa = flagi.glowa ?? json.glowa ?? "HEAD";
  const repo = path.resolve(flagi.repo ?? json.repo ?? process.cwd());
  const parserSciezka = path.resolve(flagi.parser ?? json.parser ?? PARSER_DOMYSLNY);
  const dowodyJson = Array.isArray(json.dowody) ? json.dowody : json.dowody ? [json.dowody] : [];
  const dowody = [...dowodyJson, ...flagi.dowody];
  Object.assign(kontekst, {
    baza,
    glowa,
    dowody: dowody.map((d) => ({ podany: d, wazny: dowodWazny(repo, d) })),
  });

  if (!baza) return raportuj(kontekst, KOD.BRAK_POMIARU, ["brak --baza: nie wiadomo, względem czego sprawdzać"]);
  if (gitOrNull(repo, ["rev-parse", "--is-inside-work-tree"])?.trim() !== "true") {
    return raportuj(kontekst, KOD.BRAK_POMIARU, [`nie repozytorium git: ${repo}`]);
  }
  for (const [nazwa, ref] of [["baza", baza], ["glowa", glowa]]) {
    if (gitOrNull(repo, ["rev-parse", "--verify", "--quiet", `${ref}^{commit}`]) === null) {
      return raportuj(kontekst, KOD.BRAK_POMIARU, [`${nazwa} nie wskazuje na commit: ${ref}`]);
    }
  }
  if (!fs.existsSync(parserSciezka)) {
    return raportuj(kontekst, KOD.BRAK_POMIARU, [`brak parsera gherkin.mjs: ${parserSciezka} (podaj --parser=<ścieżka>)`]);
  }
  let parsuj;
  try {
    const mod = await import(pathToFileURL(parserSciezka).href);
    parsuj = mod.parsujFeature;
    if (typeof parsuj !== "function") throw new Error("brak eksportu parsujFeature");
  } catch (e) {
    return raportuj(kontekst, KOD.BRAK_POMIARU, [`parser nie działa: ${pierwszaLinia(e)}`]);
  }

  let wynik;
  try {
    wynik = analizuj({ repo, baza, glowa, dowody, parsuj });
  } catch (e) {
    return raportuj(kontekst, KOD.BRAK_POMIARU, [`git: ${pierwszaLinia(e)}`]);
  }

  for (const n of wynik.naruszenia) process.stderr.write(`${n.plik}:${n.linia} ${n.typ}: ${n.opis}\n`);
  for (const d of wynik.decyzje) process.stderr.write(`DECYZJA ${d.plik}:${d.linia} ${d.typ}: ${d.opis}\n`);

  const kod = wynik.naruszenia.length ? KOD.NARUSZENIE : wynik.decyzje.length ? KOD.DECYZJA : wynik.brakPomiaru.length ? KOD.BRAK_POMIARU : KOD.ZIELONO;
  const niesprawdzone = [...wynik.brakPomiaru];
  if (dowody.length) niesprawdzone.push("treść dowodu nie jest czytana: sprawdzane jest tylko istnienie pliku albo commita");
  Object.assign(kontekst, {
    pliki_feature: wynik.pliki,
    scenariusze: wynik.scenariusze,
    naruszenia: wynik.naruszenia.map(({ plik, linia, typ, opis }) => ({ plik, linia, typ, opis })),
    decyzje: wynik.decyzje.map(({ plik, linia, typ, opis }) => ({ plik, linia, typ, opis })),
  });
  return raportuj(kontekst, kod, niesprawdzone);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2)).then((kod) => {
    process.exitCode = kod;
  });
}
