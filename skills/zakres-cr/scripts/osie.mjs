#!/usr/bin/env node
// Osie code review = ścieżki klienta z pliku projektu (.claude/projekt-heniek.json), nie z pamięci modelu.
// Skrypt liczy, model interpretuje: dla zakresu git (albo listy plików) mówi, które ścieżki diff dotyka,
// ile plików na każdej, jakie testy osi uruchomić i które pliki nie leżą na żadnej ścieżce.
//
// Limit --max (domyślnie 3) to liczba AGENTÓW NA FALĘ, nie liczba ścieżek: ścieżki ponad limit nie wypadają,
// tylko idą do kolejnej fali (fale: [[...max ścieżek], [...], ...], wg wagi). `pominiete` zostaje wyłącznie
// dla ścieżek pominiętych z jawnego powodu (np. diff dotyka tylko testów ścieżki).
//
// Użycie:  node osie.mjs [--config=<plik>] [--zakres=<baza>...<glowa> | --pliki=a,b,c] [--max=3] [--json] [--waliduj]
//          bez --zakres i --pliki: origin/<galaz_bazowa>...HEAD (galaz_bazowa z pliku, domyślnie main)
//          --waliduj: struktura pliku + każdy glob musi trafiać w istniejący plik repo (git ls-files)
// Kody wyjścia: 0 pomiar zrobiony (także pusty zakres, raport to mówi), 2 brak pomiaru
//               (brak lub błędny plik projektu, zła flaga, git nie odpowiedział). Fail-closed: zero nie znaczy "nic nie zmierzono".
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

export const DOMYSLNY_KONFIG = path.join(".claude", "projekt-heniek.json");
export const DOMYSLNY_MAX = 3;
export const RODZAJ_NIEPRZYPISANE = "nieprzypisane";

/** Glob -> RegExp: `**` dowolne katalogi, `*` w obrębie segmentu, `?` jeden znak; wzorzec kończący się `/` to prefiks katalogu. */
export function globNaRegex(glob) {
  let g = String(glob).replace(/\\/g, "/").replace(/^\.\//, "");
  if (g.endsWith("/")) g += "**";
  let re = "";
  for (let i = 0; i < g.length; i++) {
    const c = g[i];
    if (c === "*" && g[i + 1] === "*") {
      if (g[i + 2] === "/") { re += "(?:.*/)?"; i += 2; } else { re += ".*"; i += 1; }
    } else if (c === "*") re += "[^/]*";
    else if (c === "?") re += "[^/]";
    else re += /[.+^${}()|[\]\\]/.test(c) ? `\\${c}` : c;
  }
  return new RegExp(`^${re}$`);
}

const czyListaWzorcow = (a) => Array.isArray(a) && a.length > 0 && a.every((p) => typeof p === "string" && p.trim());

/** Zwraca listę błędów walidacji (pusta = poprawny). */
export function waliduj(k) {
  const b = [];
  if (!k || typeof k !== "object" || Array.isArray(k)) return ["plik projektu nie jest obiektem JSON"];
  if (k.galaz_bazowa !== undefined && (typeof k.galaz_bazowa !== "string" || !k.galaz_bazowa.trim())) b.push("galaz_bazowa musi być niepustym tekstem");
  if (k.nie_sciezki !== undefined) {
    if (!Array.isArray(k.nie_sciezki)) b.push("nie_sciezki musi być tablicą {rodzaj, pliki}");
    else k.nie_sciezki.forEach((n, i) => {
      if (!n || typeof n.rodzaj !== "string" || !n.rodzaj.trim() || !czyListaWzorcow(n.pliki)) b.push(`nie_sciezki[${i}]: wymaga rodzaj (tekst) i pliki (niepusta tablica wzorców)`);
    });
  }
  if (!Array.isArray(k.sciezki) || k.sciezki.length === 0) {
    b.push("sciezki musi być niepustą tablicą (co najmniej jedna ścieżka klienta)");
    return b;
  }
  const ids = new Set();
  k.sciezki.forEach((s, i) => {
    const gdzie = `sciezki[${i}]`;
    if (!s || typeof s !== "object") { b.push(`${gdzie}: nie jest obiektem`); return; }
    if (typeof s.id !== "string" || !s.id.trim()) b.push(`${gdzie}: brak id`);
    else if (ids.has(s.id)) b.push(`${gdzie}: powtórzone id ${s.id}`);
    else ids.add(s.id);
    if (typeof s.nazwa !== "string" || !s.nazwa.trim()) b.push(`${gdzie}: brak nazwy`);
    if (!czyListaWzorcow(s.pliki)) b.push(`${gdzie}: pliki musi być niepustą tablicą wzorców`);
    for (const pole of ["pliki_testowe", "pliki_dawne"]) {
      if (s[pole] !== undefined && !czyListaWzorcow(s[pole])) b.push(`${gdzie}: ${pole} musi być niepustą tablicą wzorców (albo pole pominięte)`);
    }
    if (s.kategoria !== undefined && (typeof s.kategoria !== "string" || !s.kategoria.trim())) b.push(`${gdzie}: kategoria musi być niepustym tekstem`);
    if (s.waga !== undefined && (!Number.isInteger(s.waga) || s.waga < 1 || s.waga > 5)) b.push(`${gdzie}: waga musi być liczbą całkowitą 1-5`);
    if (s.testy !== undefined && (!Array.isArray(s.testy) || s.testy.some((t) => typeof t !== "string"))) b.push(`${gdzie}: testy musi być tablicą poleceń`);
  });
  return b;
}

/**
 * Sprawdza, że wzorce trafiają w pliki, które istnieją (`pliki`, `pliki_testowe`, `nie_sciezki`), a wzorce `pliki_dawne` w żaden
 * (dawne = pliki usunięte z repo, trzymane po to, by stary diff też dał się przypisać; wzorzec, który znów trafia w plik, jest literówką).
 * Zwraca listę błędów (pusta = poprawny).
 */
export function sprawdzGloby(konfig, plikiRepo) {
  const b = [];
  const trafia = (g) => { const re = globNaRegex(g); return plikiRepo.some((p) => re.test(p)); };
  for (const s of konfig.sciezki) {
    for (const pole of ["pliki", "pliki_testowe"]) {
      for (const g of s[pole] ?? []) if (!trafia(g)) b.push(`${s.id}.${pole}: wzorzec "${g}" nie trafia w żaden istniejący plik`);
    }
    for (const g of s.pliki_dawne ?? []) if (trafia(g)) b.push(`${s.id}.pliki_dawne: wzorzec "${g}" trafia w istniejący plik (to nie jest plik dawny)`);
  }
  for (const n of konfig.nie_sciezki ?? []) {
    for (const g of n.pliki) if (!trafia(g)) b.push(`nie_sciezki[${n.rodzaj}]: wzorzec "${g}" nie trafia w żaden istniejący plik`);
  }
  return b;
}

/** Pliki repo (śledzone i nowe, bez ignorowanych), które istnieją na dysku. */
export function plikiRepo(cwd = process.cwd()) {
  const r = spawnSync("git", ["ls-files", "-z", "--cached", "--others", "--exclude-standard"], { cwd, encoding: "utf8", maxBuffer: 256 * 1024 * 1024 });
  if (r.status !== 0) return { blad: `git ls-files nie zadziałał: ${(r.stderr || "").trim() || "kod " + r.status}` };
  const pliki = r.stdout.split("\0").filter(Boolean).filter((p) => fs.existsSync(path.join(cwd, p)));
  return { pliki };
}

export function wczytajKonfig(plik) {
  let tekst;
  try { tekst = fs.readFileSync(plik, "utf8"); } catch { return { blad: `brak pliku projektu ${plik} (wzór: assets/projekt-heniek.przyklad.json skilla zakres-cr)` }; }
  let k;
  try { k = JSON.parse(tekst.replace(/^﻿/, "")); } catch (e) { return { blad: `niepoprawny JSON w ${plik}: ${e.message}` }; }
  const bledy = waliduj(k);
  return bledy.length ? { blad: `błędny plik projektu ${plik}:\n  - ${bledy.join("\n  - ")}` } : { konfig: k };
}

/** Dzieli posortowane ścieżki na fale po `max` (limit = agenci na falę). Nic nie wypada. */
export function podzielNaFale(osie, max = DOMYSLNY_MAX) {
  const fale = [];
  for (let i = 0; i < osie.length; i += max) fale.push(osie.slice(i, i + max).map((o) => ({ ...o, fala: fale.length + 1 })));
  return fale;
}

/**
 * Rdzeń: pliki -> ścieżki -> fale. Plik może leżeć na kilku ścieżkach (np. wspólny moduł).
 * Plik z `pliki_testowe` ścieżki jest jej testem, nie jej kodem: ścieżka dotknięta TYLKO testami trafia do `pominiete` z jawnym powodem.
 * Pliki bez ścieżki dostają rodzaj z `nie_sciezki` (testy, dokumenty, konfiguracja...) albo "nieprzypisane" (kod, który nikt nie recenzuje).
 */
export function przypiszOsie(pliki, konfig, max = DOMYSLNY_MAX) {
  const sciezki = konfig.sciezki.map((s) => ({
    ...s,
    waga: s.waga ?? 1,
    re: [...s.pliki, ...(s.pliki_dawne ?? [])].map(globNaRegex),
    reTesty: (s.pliki_testowe ?? []).map(globNaRegex)
  }));
  const nie = (konfig.nie_sciezki ?? []).map((n) => ({ rodzaj: n.rodzaj, re: n.pliki.map(globNaRegex) }));
  const dotkniete = new Map();
  const tylkoTesty = new Map();
  const poza = [];
  const pozaRodzaje = {};
  const nowa = (s) => ({ id: s.id, nazwa: s.nazwa, waga: s.waga, kategoria: s.kategoria ?? null, testy: s.testy ?? [], pliki: [], testy_zmienione: [] });
  for (const surowy of new Set(pliki.map((p) => p.replace(/\\/g, "/")))) {
    const plik = surowy;
    const testowe = sciezki.filter((s) => s.reTesty.some((r) => r.test(plik)));
    if (testowe.length) {
      for (const s of testowe) {
        if (!tylkoTesty.has(s.id)) tylkoTesty.set(s.id, { s, pliki: [] });
        tylkoTesty.get(s.id).pliki.push(plik);
      }
      continue;
    }
    const trafione = sciezki.filter((s) => s.re.some((r) => r.test(plik)));
    if (trafione.length === 0) {
      poza.push(plik);
      const rodzaj = nie.find((n) => n.re.some((r) => r.test(plik)))?.rodzaj ?? RODZAJ_NIEPRZYPISANE;
      (pozaRodzaje[rodzaj] ??= []).push(plik);
      continue;
    }
    for (const s of trafione) {
      if (!dotkniete.has(s.id)) dotkniete.set(s.id, nowa(s));
      dotkniete.get(s.id).pliki.push(plik);
    }
  }
  const pominiete = [];
  for (const [id, { s, pliki: testy }] of tylkoTesty) {
    if (dotkniete.has(id)) dotkniete.get(id).testy_zmienione = testy;
    else pominiete.push({ ...nowa(s), testy_zmienione: testy, powod: "diff dotyka tylko plików testowych tej ścieżki: uruchom testy osi, recenzent kodu niepotrzebny" });
  }
  const osie = [...dotkniete.values()].sort((a, b) => b.waga - a.waga || b.pliki.length - a.pliki.length || a.id.localeCompare(b.id));
  const wszystkie = [...osie.map((o) => o.id), ...pominiete.map((o) => o.id)];
  return {
    liczba_plikow: new Set(pliki.map((p) => p.replace(/\\/g, "/"))).size,
    pusty: pliki.length === 0,
    max,
    liczba_osi: osie.length,
    dotkniete: wszystkie,
    fale: podzielNaFale(osie, max),
    pominiete,
    poza_sciezkami: poza,
    poza_rodzaje: pozaRodzaje,
    bez_testow: osie.filter((o) => o.testy.length === 0).map((o) => o.id)
  };
}

/**
 * Niezmiennik pokrycia: każda dotknięta ścieżka jest dokładnie raz w fali albo w `pominiete` (z powodem), a fala ma najwyżej `max` agentów.
 * Zwraca listę naruszeń (pusta = poprawny). Wołane w CLI po pomiarze: naruszenie = brak pomiaru, nie cichy raport.
 */
export function sprawdzPokrycie(w) {
  const b = [];
  const widziane = new Map();
  w.fale.forEach((f, i) => {
    if (f.length === 0) b.push(`fala ${i + 1} jest pusta`);
    if (f.length > w.max) b.push(`fala ${i + 1} ma ${f.length} agentów, limit na falę ${w.max}`);
    for (const o of f) widziane.set(o.id, [...(widziane.get(o.id) ?? []), `fala ${i + 1}`]);
  });
  for (const o of w.pominiete) {
    if (typeof o.powod !== "string" || !o.powod.trim()) b.push(`ścieżka ${o.id} pominięta bez powodu`);
    widziane.set(o.id, [...(widziane.get(o.id) ?? []), "pominięta"]);
  }
  for (const id of w.dotkniete) {
    const gdzie = widziane.get(id);
    if (!gdzie) b.push(`ścieżka ${id} dotknięta przez diff, a nie ma jej ani w fali, ani wśród pominiętych z powodem`);
    else if (gdzie.length > 1) b.push(`ścieżka ${id} występuje wielokrotnie: ${gdzie.join(", ")}`);
  }
  for (const id of widziane.keys()) if (!w.dotkniete.includes(id)) b.push(`ścieżka ${id} w wyniku, choć diff jej nie dotyka`);
  return b;
}

export function plikiZGita(zakres, cwd = process.cwd()) {
  const r = spawnSync("git", ["diff", "--name-only", zakres], { cwd, encoding: "utf8", maxBuffer: 256 * 1024 * 1024 });
  if (r.status !== 0) return { blad: `git diff --name-only ${zakres} nie zadziałał: ${(r.stderr || "").trim() || "kod " + r.status}` };
  return { pliki: r.stdout.split(/\r?\n/).map((l) => l.trim()).filter(Boolean) };
}

const liczbaPlikow = (o) => `${o.pliki.length}${o.testy_zmienione.length ? ` (+${o.testy_zmienione.length} testów)` : ""}`;

function formatuj(w, zakres) {
  const out = [`Zakres: ${zakres} - plików: ${w.liczba_plikow}`];
  if (w.pusty) out.push("ZAKRES PUSTY: brak zmienionych plików (sprawdź bazę i git fetch, zanim uznasz, że nie ma czego recenzować)");
  out.push("", "| oś | nazwa | waga | pliki | testy osi | fala |", "|---|---|---|---|---|---|");
  const skrot = (t) => (t.length > 70 ? `${t.slice(0, 67)}...` : t);
  for (const f of w.fale) for (const o of f) out.push(`| ${o.id} | ${o.nazwa} | ${o.waga} | ${liczbaPlikow(o)} | ${o.testy.length ? o.testy.map(skrot).join("; ") : "BRAK (luka testowa)"} | ${o.fala} |`);
  if (w.fale.length === 0) out.push("| - | diff nie dotyka żadnej ścieżki klienta do recenzji | - | 0 | - | - |");
  const dlugie = w.fale.flat().filter((o) => o.testy.some((t) => t.length > 70));
  if (dlugie.length) {
    out.push("", "Polecenia testów osi (pełne):");
    for (const o of dlugie) for (const t of o.testy) out.push(`- ${o.id}: ${t}`);
  }
  out.push("", "Tabela pokrycia ścieżek:", "| ścieżka | status |", "|---|---|");
  for (const f of w.fale) for (const o of f) out.push(`| ${o.id} (${o.nazwa}) | zrecenzowana (fala ${o.fala}) |`);
  for (const o of w.pominiete) out.push(`| ${o.id} (${o.nazwa}) | pominięta: ${o.powod} |`);
  if (w.fale.length === 0 && w.pominiete.length === 0) out.push("| - | brak dotkniętych ścieżek |");
  const rodzaje = Object.entries(w.poza_rodzaje);
  if (w.poza_sciezkami.length) {
    out.push("", `Poza ścieżkami (${w.poza_sciezkami.length}, bez agenta: sprawdza skrypt):`);
    for (const [rodzaj, lista] of rodzaje) {
      const pelna = rodzaj === RODZAJ_NIEPRZYPISANE || lista.length <= 5;
      const podglad = pelna ? lista.join(", ") : `${lista.slice(0, 5).join(", ")}, ... (${lista.length - 5} więcej)`;
      out.push(`- ${rodzaj}${rodzaj === RODZAJ_NIEPRZYPISANE ? " (kod bez ścieżki: dopisz do ścieżki w pliku projektu albo podaj jawny powód)" : ""} [${lista.length}]: ${podglad}`);
    }
  }
  const agenci = w.fale.reduce((n, f) => n + f.length, 0);
  out.push("", `Agentów recenzji: ${agenci} (jeden na oś), fal: ${w.fale.length}, najwyżej ${w.max} agentów na falę.`);
  w.fale.forEach((f, i) => out.push(`Fala ${i + 1}: ${f.map((o) => o.id).join(", ")}`));
  return out.join("\n");
}

function main(argv) {
  const f = { config: DOMYSLNY_KONFIG, zakres: undefined, pliki: undefined, max: DOMYSLNY_MAX, json: false, waliduj: false };
  for (const a of argv) {
    const m = /^--([a-z]+)(?:=(.*))?$/.exec(a);
    if (!m) { console.error(`nieznany argument: ${a}`); return 2; }
    const [, k, v] = m;
    if (k === "config" && v) f.config = v;
    else if (k === "zakres" && v) f.zakres = v;
    else if (k === "pliki" && v !== undefined) f.pliki = v.split(",").map((s) => s.trim()).filter(Boolean);
    else if (k === "max" && /^[1-9]\d*$/.test(v ?? "")) f.max = Number(v);
    else if (k === "json" && v === undefined) f.json = true;
    else if (k === "waliduj" && v === undefined) f.waliduj = true;
    else { console.error(`zła flaga: ${a}\nużycie: node osie.mjs [--config=<plik>] [--zakres=<baza>...<glowa> | --pliki=a,b] [--max=3] [--json] [--waliduj]`); return 2; }
  }
  const { konfig, blad } = wczytajKonfig(f.config);
  if (blad) { console.error(`BRAK POMIARU: ${blad}`); return 2; }
  if (f.waliduj) {
    const r = plikiRepo();
    if (r.blad) { console.error(`BRAK POMIARU: ${r.blad}`); return 2; }
    const bledy = sprawdzGloby(konfig, r.pliki);
    if (bledy.length) { console.error(`BŁĘDNE WZORCE w ${f.config}:\n  - ${bledy.join("\n  - ")}`); return 2; }
    console.log(`OK: ${f.config} poprawny, ścieżek: ${konfig.sciezki.length}, wzorce trafiają w istniejące pliki (plików repo: ${r.pliki.length})`);
    return 0;
  }
  const zakres = f.zakres ?? `origin/${konfig.galaz_bazowa ?? "main"}...HEAD`;
  let pliki = f.pliki;
  if (!pliki) {
    const g = plikiZGita(zakres);
    if (g.blad) { console.error(`BRAK POMIARU: ${g.blad}`); return 2; }
    pliki = g.pliki;
  }
  const w = przypiszOsie(pliki, konfig, f.max);
  const naruszenia = sprawdzPokrycie(w);
  if (naruszenia.length) { console.error(`BRAK POMIARU: niezmiennik pokrycia ścieżek naruszony:\n  - ${naruszenia.join("\n  - ")}`); return 2; }
  console.log(f.json ? JSON.stringify({ zakres: f.pliki ? "(lista plików)" : zakres, ...w }, null, 2) : formatuj(w, f.pliki ? "(lista plików)" : zakres));
  return 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exit(main(process.argv.slice(2)));
}
