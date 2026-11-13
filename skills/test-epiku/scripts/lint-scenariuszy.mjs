#!/usr/bin/env node
// lint-scenariuszy.mjs - kontrola NOWYCH plików .feature przed przekazaniem do przekliku (test-epiku, bramka fali).
// Użycie:
//   node lint-scenariuszy.mjs --baza=<ref> [--glowa=<ref>] [--repo=<katalog>] [--parser=<gherkin.mjs>]
//   node lint-scenariuszy.mjs --pliki=<a.feature,b.feature> [--parser=<gherkin.mjs>]
// Domyślnie sprawdza TYLKO pliki .feature dodane lub zmienione w baza...glowa (stare pliki nie blokują pracy).
// Reguły:
//   1. jeden blok Kiedy/Gdy/When (zero albo więcej niż jeden = naruszenie);
//   2. poniżej 10 kroków (kroki tła i scenariusza, jak liczy parser);
//   3. Wtedy/Wówczas/Then sprawdzalne: brak Wtedy = naruszenie; w zdaniu Wtedy nie ma "działa", "jest ok" itp.;
//   4. w zdaniach nie ma selektorów CSS, czekań ani adresów API.
// Wyjątek: scenariusz z metką @podroz jest zwolniony z reguł 1 i 2 (świadomie opisana dłuższa podróż użytkownika).
// Reguły 3 i 4 obowiązują zawsze, także dla @podroz.
// Parser kroków: lokalna kopia scripts/lib/gherkin.mjs (bajt w bajt z paczki przekliki-ogorkowe; test parytetu
// pilnuje zgodności). Brak pliku parsera = kod 2. Inny parser podasz przez --parser=.
// Wyjście: JSON na stdout {krok, kod, wynik, pliki, scenariusze, naruszenia, niesprawdzone}.
// Kody: 0 czysto, 1 naruszenie (plik:linia), 2 brak pomiaru. Zero plików .feature w zakresie = kod 2
// (wynik BRAK_PLIKOW_FEATURE): decyzja właściciela, kontrola nie zaszła, więc nie liczy się jako zielone.
// Skrypt nic nie zapisuje, więc --sucho nie jest potrzebne.
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";

const TU = path.dirname(fileURLToPath(import.meta.url));
export const PARSER_DOMYSLNY = path.resolve(TU, "lib/gherkin.mjs");

const KIEDY = new Set(["Kiedy", "Gdy", "When"]);
const WTEDY = new Set(["Wtedy", "Wówczas", "Then"]);
const ZAKLADAM = new Set(["Zakładając, że", "Zakładając że", "Zakładając", "Mając", "Given"]);
const KONTYNUACJA = new Set(["Oraz", "I", "Ale", "And", "But"]);
const MAX_KROKOW = 10;

const slowoCalosciowe = (s, flagi = "iu") => new RegExp(`(?<!\\p{L})(?:${s})(?!\\p{L})`, flagi);
const ZAKAZANE_W_WTEDY = [
  [slowoCalosciowe("działa"), "\"działa\""],
  [slowoCalosciowe("jest ok"), "\"jest ok\""],
  [slowoCalosciowe("jest w porządku"), "\"jest w porządku\""],
  [slowoCalosciowe("wygląda dobrze"), "\"wygląda dobrze\""],
  [slowoCalosciowe("poprawnie"), "\"poprawnie\""],
  [slowoCalosciowe("prawidłowo"), "\"prawidłowo\""],
  [slowoCalosciowe("works"), "\"works\""],
  [slowoCalosciowe("looks good"), "\"looks good\""],
];
const SELEKTORY = [
  [/\[[\w-]+(?:[~|^$*]?=[^\]]*)?\]/u, "selektor atrybutu CSS"],
  [/(?:^|[\s"'(])[.#][a-zA-Z][\w-]*(?=[\s"')>,:[\]]|$)/u, "selektor klasy lub id CSS"],
  [/:(?:nth-child|first-child|last-child|not|has|is|where)\(/u, "pseudoklasa CSS"],
  [/data-testid|data-cy|data-qa/u, "selektor testowy"],
];
const CZEKANIA = [
  [slowoCalosciowe("czekam|czekaj\\p{L}*|poczekaj\\p{L}*|odczekaj\\p{L}*|wait\\p{L}*|sleep"), "czekanie"],
  [/(?<![\p{L}\d])\d+\s?(?:ms|s|sek\.?|sekund\p{L}*|milisekund\p{L}*)(?![\p{L}\d])/iu, "czas oczekiwania"],
];
const ADRESY_API = [
  [/https?:\/\//iu, "adres http(s)"],
  [/(?:^|[\s"'(])\/api\//u, "ścieżka API"],
  [/(?<!\p{L})(?:GET|POST|PUT|PATCH|DELETE)\s+\//u, "wywołanie HTTP"],
];

/**
 * Reguły dla jednej sparsowanej funkcji (wynik parsujFeature). Zwraca naruszenia {linia, opis}.
 * @param {{ scenariusze: any[], tlo: any[] }} funkcja
 */
export function lintFunkcja(funkcja) {
  const naruszenia = [];
  const dodaj = (linia, opis) => naruszenia.push({ linia, opis });
  const sprawdzTekst = (krok) => {
    for (const [wzorzec, kategoria] of [...SELEKTORY, ...CZEKANIA, ...ADRESY_API]) {
      if (wzorzec.test(krok.tekst)) dodaj(krok.linia, `${kategoria} w zdaniu "${krok.slowo} ${krok.tekst}"`);
    }
  };
  funkcja.tlo.forEach(sprawdzTekst);
  for (const s of funkcja.scenariusze) {
    const podroz = s.metki.includes("@podroz");
    let kiedy = 0;
    let wtedy = 0;
    let blok = "zaklad";
    for (const k of s.kroki) {
      if (KIEDY.has(k.slowo)) { blok = "kiedy"; kiedy++; }
      else if (WTEDY.has(k.slowo)) { blok = "wtedy"; wtedy++; }
      else if (ZAKLADAM.has(k.slowo)) blok = "zaklad";
      else if (!KONTYNUACJA.has(k.slowo)) throw new Error(`nieznany rodzaj kroku: ${k.slowo}`);
      if (blok === "wtedy") {
        for (const [wzorzec, slowo] of ZAKAZANE_W_WTEDY) {
          if (wzorzec.test(k.tekst)) dodaj(k.linia, `Wtedy nie jest sprawdzalne: zawiera ${slowo} ("${k.slowo} ${k.tekst}")`);
        }
      }
      sprawdzTekst(k);
    }
    if (wtedy === 0) dodaj(s.linia, `scenariusz "${s.nazwa}" nie ma Wtedy: nic nie sprawdza`);
    if (!podroz && kiedy !== 1) dodaj(s.linia, `scenariusz "${s.nazwa}" ma ${kiedy} bloków Kiedy (wymagany dokładnie 1)`);
    const liczbaKrokow = funkcja.tlo.length + s.kroki.length;
    if (!podroz && liczbaKrokow >= MAX_KROKOW) dodaj(s.linia, `scenariusz "${s.nazwa}" ma ${liczbaKrokow} kroków (poniżej ${MAX_KROKOW})`);
  }
  return naruszenia;
}

function git(repo, args) {
  return execFileSync("git", ["-C", repo, "-c", "core.quotepath=off", ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], maxBuffer: 64 * 1024 * 1024 });
}

/** Pliki .feature dodane lub zmienione w baza...glowa, z treścią z glowa. */
function plikiZDiffa(repo, baza, glowa) {
  const lista = git(repo, ["diff", "--name-only", "--no-renames", "--diff-filter=AMR", `${baza}...${glowa}`]);
  return lista.split(/\r?\n/).filter((p) => p.endsWith(".feature")).map((p) => ({ plik: p, tresc: git(repo, ["show", `${glowa}:${p}`]) }));
}

function linieZBledu(msg) {
  const m = msg.match(/:(\d+) - /);
  return m ? Number(m[1]) : 1;
}

async function main(argv) {
  const opcje = { baza: null, glowa: "HEAD", repo: process.cwd(), parser: PARSER_DOMYSLNY, pliki: null };
  for (const a of argv) {
    if (a.startsWith("--baza=")) opcje.baza = a.slice(7);
    else if (a.startsWith("--glowa=")) opcje.glowa = a.slice(8);
    else if (a.startsWith("--repo=")) opcje.repo = path.resolve(a.slice(7));
    else if (a.startsWith("--parser=")) opcje.parser = path.resolve(a.slice(9));
    else if (a.startsWith("--pliki=")) opcje.pliki = a.slice(8).split(",").map((s) => s.trim()).filter(Boolean);
    else { process.stderr.write(`zły argument: ${a}\nużycie: lint-scenariuszy.mjs --baza=<ref> [--glowa=<ref>] | --pliki=<lista>\n`); return 2; }
  }
  const raport = (kod, wynik, extra = {}) => {
    process.stdout.write(JSON.stringify({ krok: "lint-scenariuszy", kod, wynik, ...extra }, null, 2) + "\n");
    return kod;
  };
  if (!opcje.pliki && !opcje.baza) return raport(2, "BRAK POMIARU", { niesprawdzone: ["brak --baza ani --pliki: nie wiadomo, które pliki sprawdzić"] });
  if (!fs.existsSync(opcje.parser)) return raport(2, "BRAK POMIARU", { niesprawdzone: [`brak parsera gherkin.mjs: ${opcje.parser}`] });
  const { parsujFeature } = await import(pathToFileURL(opcje.parser).href);

  let zrodla;
  try {
    zrodla = opcje.pliki
      ? opcje.pliki.map((p) => ({ plik: p, tresc: fs.readFileSync(path.resolve(opcje.repo, p), "utf8") }))
      : plikiZDiffa(opcje.repo, opcje.baza, opcje.glowa);
  } catch (e) {
    return raport(2, "BRAK POMIARU", { niesprawdzone: [`nie udało się odczytać plików: ${e.message.split("\n")[0]}`] });
  }

  const naruszenia = [];
  let scenariusze = 0;
  for (const { plik, tresc } of zrodla) {
    let funkcja;
    try {
      funkcja = parsujFeature(tresc, plik);
    } catch (e) {
      naruszenia.push({ plik, linia: linieZBledu(e.message), opis: `parser: ${e.message}` });
      continue;
    }
    scenariusze += funkcja.scenariusze.length;
    for (const n of lintFunkcja(funkcja)) naruszenia.push({ plik, linia: n.linia, opis: n.opis });
  }
  for (const n of naruszenia) process.stderr.write(`${n.plik}:${n.linia}: ${n.opis}\n`);
  const brakPlikow = zrodla.length === 0;
  const kod = naruszenia.length ? 1 : brakPlikow ? 2 : 0;
  const wynik = brakPlikow ? "BRAK_PLIKOW_FEATURE" : kod === 0 ? "CZYSTO" : "NARUSZENIE";
  return raport(kod, wynik, {
    pliki: zrodla.length,
    scenariusze,
    naruszenia: naruszenia.map((n) => ({ plik: n.plik, linia: n.linia, opis: n.opis })),
    niesprawdzone: brakPlikow ? ["zero plików .feature w zakresie: kontrola metek scenariuszy nie zaszła"] : [],
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2)).then((kod) => { process.exitCode = kod; });
}
