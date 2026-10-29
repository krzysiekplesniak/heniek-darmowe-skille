#!/usr/bin/env node
// Minimalny, ścisły parser plików .feature (Gherkin) po polsku i po angielsku, bez zależności.
// Zakres świadomie wąski: Funkcja/Feature, opis, Tło/Background, Scenariusz/Przykład/Scenario/Example,
// metki @x, komentarze #, kroki Zakładając/Mając/Kiedy/Gdy/Wtedy/Wówczas/Oraz/I/Ale oraz Given/When/Then/And/But.
// Linia, której parser nie rozumie wewnątrz scenariusza, jest BŁĘDEM (rzuca), a nie cicho pominiętym krokiem:
// pominięty krok dałby zielony przeklik, który niczego nie sprawdził.
//
// Ten sam plik kopiujesz do repo jako silnik przeklików (import z przekliki.spec.ts).
// CLI (kontrola scenariuszy przed uruchomieniem przeglądarki):
//   node gherkin.mjs <katalog> [--metki=@jest,@na-galezi] [--json]
// Kody wyjścia: 0 wszystkie pliki poprawne, 1 błędy parsowania, 2 brak pomiaru (brak katalogu albo zero plików .feature).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const DOMYSLNE_METKI = ["@jest", "@na-galezi"];

const SLOWA_KROKU = [
  "Zakładając, że", "Zakładając że", "Zakładając", "Mając", "Kiedy", "Gdy", "Wtedy", "Wówczas", "Oraz", "I", "Ale",
  "Given", "When", "Then", "And", "But"
];
const WZORZEC_KROKU = new RegExp(`^(${SLOWA_KROKU.map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})\\s+(.+)$`, "u");
const FUNKCJA = /^(?:Funkcja|Właściwość|Feature):\s*(.*)$/u;
const TLO = /^(?:Tło|Background):/u;
const SCENARIUSZ = /^(?:Scenariusz|Przykład|Scenario|Example):\s*(.*)$/u;
const NIEOBSLUGIWANE = /^(?:Szablon scenariusza|Przykłady|Reguła|Założenia|Scenario Outline|Scenario Template|Examples|Scenarios|Rule):/u;

/**
 * @typedef {{ slowo: string, tekst: string, linia: number }} Krok
 * @typedef {{ nazwa: string, metki: string[], kroki: Krok[], linia: number }} Scenariusz
 * @typedef {{ plik: string, nazwa: string, opis: string[], metki: string[], tlo: Krok[], scenariusze: Scenariusz[] }} Funkcja
 */

/**
 * @param {string} tresc
 * @param {string} [plik]
 * @returns {Funkcja}
 */
export function parsujFeature(tresc, plik = "<tekst>") {
  /** @type {Funkcja} */
  const funkcja = { plik, nazwa: "", opis: [], metki: [], tlo: [], scenariusze: [] };
  /** @type {string[]} */
  let metki = [];
  let tryb = "przed";
  /** @type {Scenariusz | null} */
  let biezacy = null;
  tresc.replace(/^﻿/, "").split(/\r?\n/).forEach((surowa, i) => {
    const nr = i + 1;
    const linia = surowa.trim();
    if (!linia || linia.startsWith("#")) return;
    if (linia.startsWith("@")) {
      const slowa = linia.split(/\s+/);
      if (slowa.some((s) => !s.startsWith("@"))) throw new Error(`${plik}:${nr} - linia metek zawiera coś poza metkami: "${linia}"`);
      metki.push(...slowa);
      return;
    }
    let m = linia.match(FUNKCJA);
    if (m) {
      if (funkcja.nazwa) throw new Error(`${plik}:${nr} - druga Funkcja w jednym pliku`);
      Object.assign(funkcja, { nazwa: m[1].trim(), metki });
      metki = [];
      tryb = "opis";
      return;
    }
    if (TLO.test(linia)) {
      if (tryb !== "opis") throw new Error(`${plik}:${nr} - Tło musi stać przed pierwszym scenariuszem`);
      tryb = "tlo";
      return;
    }
    m = linia.match(SCENARIUSZ);
    if (m) {
      if (!funkcja.nazwa) throw new Error(`${plik}:${nr} - scenariusz przed "Funkcja:"`);
      biezacy = { nazwa: m[1].trim(), metki: [...funkcja.metki, ...metki], kroki: [], linia: nr };
      metki = [];
      funkcja.scenariusze.push(biezacy);
      tryb = "scenariusz";
      return;
    }
    if (NIEOBSLUGIWANE.test(linia) || linia.startsWith("|") || linia.startsWith('"""') || linia.startsWith("```")) {
      throw new Error(`${plik}:${nr} - konstrukcja nieobsługiwana przez minimalny parser: "${linia}" (rozpisz na osobne scenariusze)`);
    }
    m = linia.match(WZORZEC_KROKU);
    if (m && (tryb === "tlo" || tryb === "scenariusz")) {
      const krok = { slowo: m[1], tekst: m[2].trim(), linia: nr };
      (tryb === "tlo" ? funkcja.tlo : biezacy.kroki).push(krok);
      return;
    }
    if (tryb === "opis") {
      funkcja.opis.push(linia);
      return;
    }
    throw new Error(`${plik}:${nr} - linia nierozpoznana (ani krok, ani komentarz, ani nagłówek): "${linia}"`);
  });
  if (!funkcja.nazwa) throw new Error(`${plik} - brak "Funkcja:" / "Feature:"`);
  for (const s of funkcja.scenariusze) {
    if (s.kroki.length === 0) throw new Error(`${plik}:${s.linia} - scenariusz "${s.nazwa}" bez kroków`);
  }
  return funkcja;
}

/** Wszystkie pliki .feature w katalogu (rekurencyjnie; pomija katalogi zaczynające się od "_", raport, node_modules). */
export function znajdzFeatures(katalog) {
  const wynik = [];
  const odwiedz = (dir) => {
    for (const nazwa of fs.readdirSync(dir).sort()) {
      if (nazwa.startsWith("_") || nazwa === "raport" || nazwa === "node_modules") continue;
      const pelna = path.join(dir, nazwa);
      if (fs.statSync(pelna).isDirectory()) odwiedz(pelna);
      else if (nazwa.endsWith(".feature")) wynik.push(pelna);
    }
  };
  odwiedz(katalog);
  return wynik;
}

/**
 * @param {string} katalog
 * @param {string} [korzen]
 * @returns {Funkcja[]}
 */
export function wczytajFeatures(katalog, korzen = process.cwd()) {
  return znajdzFeatures(katalog).map((p) => parsujFeature(fs.readFileSync(p, "utf8"), path.relative(korzen, p).split(path.sep).join("/")));
}

export function czyKlikany(scenariusz, metkiKlikane = DOMYSLNE_METKI) {
  return scenariusz.metki.some((m) => metkiKlikane.includes(m));
}

/** Przegląd katalogu: ile plików, scenariuszy klikanych i pominiętych, jakie błędy. Nie rzuca: błędy zbiera. */
export function przeglad(katalog, metkiKlikane = DOMYSLNE_METKI) {
  if (!fs.existsSync(katalog) || !fs.statSync(katalog).isDirectory()) return { kod: 2, uwaga: `brak katalogu ${katalog}` };
  const pliki = znajdzFeatures(katalog);
  if (pliki.length === 0) return { kod: 2, uwaga: `zero plików .feature w ${katalog}: nic nie zmierzono` };
  const funkcje = [];
  const bledy = [];
  for (const p of pliki) {
    try {
      funkcje.push(parsujFeature(fs.readFileSync(p, "utf8"), path.relative(process.cwd(), p).split(path.sep).join("/")));
    } catch (e) {
      bledy.push(e.message);
    }
  }
  const scen = funkcje.flatMap((f) => f.scenariusze.map((s) => ({ plik: f.plik, nazwa: s.nazwa, metki: s.metki, kroki: f.tlo.length + s.kroki.length, klikany: czyKlikany(s, metkiKlikane) })));
  return { kod: bledy.length ? 1 : 0, pliki: pliki.length, scenariusze: scen, klikane: scen.filter((s) => s.klikany).length, pominiete: scen.filter((s) => !s.klikany).length, bledy };
}

function main(argv) {
  let katalog;
  let metki = DOMYSLNE_METKI;
  let json = false;
  for (const a of argv) {
    if (a === "--json") json = true;
    else if (a.startsWith("--metki=")) metki = a.slice(8).split(",").map((s) => s.trim()).filter(Boolean);
    else if (!a.startsWith("--") && !katalog) katalog = a;
    else { console.error(`zły argument: ${a}\nużycie: node gherkin.mjs <katalog> [--metki=@jest,@na-galezi] [--json]`); return 2; }
  }
  if (!katalog) { console.error("użycie: node gherkin.mjs <katalog> [--metki=@jest,@na-galezi] [--json]"); return 2; }
  const w = przeglad(path.resolve(katalog), metki);
  if (json) { console.log(JSON.stringify(w, null, 2)); return w.kod; }
  if (w.kod === 2) { console.error(`BRAK POMIARU: ${w.uwaga}`); return 2; }
  for (const s of w.scenariusze) console.log(`${s.klikany ? "KLIKANY " : "pominięty"} ${s.plik} :: ${s.nazwa} [${s.metki.join(" ") || "bez metki"}] kroków: ${s.kroki}`);
  for (const b of w.bledy) console.error(`BŁĄD ${b}`);
  console.log(`plików: ${w.pliki}, scenariuszy: ${w.scenariusze.length}, klikanych: ${w.klikane}, pominiętych: ${w.pominiete}, błędów: ${w.bledy.length}`);
  return w.kod;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exit(main(process.argv.slice(2)));
}
