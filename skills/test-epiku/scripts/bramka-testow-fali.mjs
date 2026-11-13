#!/usr/bin/env node
// bramka-testow-fali.mjs - bramka zamknięcia TESTÓW fali (test-epiku, etap H). Nic nie zapisuje (--sucho niepotrzebne).
// Użycie:
//   node bramka-testow-fali.mjs --plan=<plik.json> [--config=<.claude/projekt-heniek.json>] [--repo=<katalog>]
// Wejście:
//   --plan: JSON planu luk i wyników fali:
//     { fala, pytania: ["Q1",...], luki: [{id, warstwa, sciezka, plik_testu, stan, sha, dowod, powod?, autor_testu?, autor_kodu?}],
//       przebiegi: [{warstwa, komenda, kod, uruchomionych}], pomiar_przed: {...}, pomiar_po: {...},
//       wynik_detektora: {kod, trafienia: [...]} }
//   --config (domyślnie <repo>/.claude/projekt-heniek.json), obiekt "testy":
//     { "zapadka": [{"klucz": "...", "kierunek": "nie_wzrasta" | "nie_spada"}], "warstwy_wymagane"?: ["..."] }
//     Brak obiektu "testy" albo "zapadka" = brak pomiaru (kod 2), bo bramka nie wie, co pilnować.
// Sprawdza:
//   - stan każdej luki: POKRYTE / ISTNIEJE (plik testu istnieje w repo, SHA podane), ODLOZONE Qn (Qn na liście pytań),
//     NIE DOTYCZY (z powodem); OCZEKIWANA CZERWIEN i nieznany stan = naruszenie;
//   - każda warstwa użyta w lukach (i warstwy_wymagane) ma przebieg z komendą, kodem i liczbą uruchomionych;
//     uruchomionych 0 albo brak = NIESPRAWDZONE (kod 2), kod != 0 = naruszenie;
//   - wynik detektora edycji testów: kod 1 = naruszenie EDYCJA TESTU, kod 2 lub brak = NIESPRAWDZONE;
//   - zapadka: każdy klucz z konfiguracji względem pomiar_przed (nie_wzrasta / nie_spada); brak pomiaru = NIESPRAWDZONE.
// NIESPRAWDZONE w tej wersji: że SHA jest przodkiem głowy (nie liczone; sprawdza tylko, czy pole jest niepuste).
// Kody: 0 zamknięte, 1 naruszenie (nazwane), 2 brak pomiaru. Kod 2 nigdy nie jest zielone; naruszenie ma pierwszeństwo.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const STANY_OK = new Set(["POKRYTE", "ISTNIEJE", "NIE DOTYCZY"]);
const ODLOZONE = /^ODLOZONE (Q\d+)$/u;

/**
 * Ocenia plan względem konfiguracji. Zwraca {naruszenia: string[], niesprawdzone: string[], luki: number}.
 * @param {any} plan
 * @param {{testy: {zapadka: {klucz: string, kierunek: string}[], warstwy_wymagane?: string[]}}} konfig
 * @param {string} repo katalog, względem którego liczone są plik_testu
 */
export function ocenPlan(plan, konfig, repo) {
  const naruszenia = [];
  const niesprawdzone = [];
  const luki = Array.isArray(plan.luki) ? plan.luki : null;
  if (!luki || luki.length === 0) {
    niesprawdzone.push("plan nie ma listy luk (albo jest pusta): nie ma czego zamykać, a pusty plan nie jest dowodem");
    return { naruszenia, niesprawdzone, luki: 0 };
  }
  const pytania = new Set(Array.isArray(plan.pytania) ? plan.pytania : []);
  const przebiegi = Array.isArray(plan.przebiegi) ? plan.przebiegi : [];

  for (const l of luki) {
    const id = l.id ?? "(bez id)";
    const stan = String(l.stan ?? "").trim();
    if (STANY_OK.has(stan)) {
      if (stan === "NIE DOTYCZY" && !String(l.powod ?? "").trim()) naruszenia.push(`${id}: NIE DOTYCZY bez powodu`);
      if (stan === "POKRYTE" || stan === "ISTNIEJE") {
        const plik = String(l.plik_testu ?? "").trim();
        if (!plik) naruszenia.push(`${id}: ${stan} bez pliku testu`);
        else if (!fs.existsSync(path.resolve(repo, plik))) naruszenia.push(`${id}: ${stan}, a plik testu nie istnieje: ${plik}`);
        if (!String(l.sha ?? "").trim()) naruszenia.push(`${id}: ${stan} bez SHA`);
      }
      continue;
    }
    const m = stan.match(ODLOZONE);
    if (m) {
      if (!pytania.has(m[1])) naruszenia.push(`${id}: ODLOZONE ${m[1]}, a ${m[1]} nie ma na liście pytań fali`);
      continue;
    }
    if (stan === "OCZEKIWANA CZERWIEN") naruszenia.push(`${id}: OCZEKIWANA CZERWIEN przy zamknięciu (kroki są, kodu brak)`);
    else naruszenia.push(`${id}: nieznany stan "${stan}"`);
  }

  const warstwy = new Set(luki.map((l) => l.warstwa).filter(Boolean));
  for (const w of konfig.testy.warstwy_wymagane ?? []) warstwy.add(w);
  for (const w of warstwy) {
    const na = przebiegi.filter((p) => p.warstwa === w);
    if (na.length === 0) {
      niesprawdzone.push(`warstwa "${w}": brak przebiegu (wiersz bez przebiegu = NIESPRAWDZONE, nie zielone)`);
      continue;
    }
    for (const p of na) {
      if (!String(p.komenda ?? "").trim()) niesprawdzone.push(`warstwa "${w}": przebieg bez komendy`);
      if (!Number.isInteger(p.kod)) niesprawdzone.push(`warstwa "${w}": przebieg bez kodu wyjścia`);
      if (!Number.isInteger(p.uruchomionych) || p.uruchomionych <= 0) {
        niesprawdzone.push(`warstwa "${w}": uruchomionych ${p.uruchomionych ?? "brak"} (zero testów = kod 2, nie zielono)`);
      } else if (p.kod !== 0) {
        naruszenia.push(`warstwa "${w}": kod wyjścia ${p.kod} (czerwona warstwa)`);
      }
    }
  }

  const det = plan.wynik_detektora;
  if (!det || !Number.isInteger(det.kod)) niesprawdzone.push("brak wyniku detektora edycji testów");
  else if (det.kod === 1) {
    for (const t of det.trafienia ?? []) naruszenia.push(`EDYCJA TESTU ${t.plik}:${t.linia} ${t.typ}`);
    if (!(det.trafienia ?? []).length) naruszenia.push("EDYCJA TESTU: detektor kod 1 bez listy trafień");
  } else if (det.kod !== 0) niesprawdzone.push(`detektor kod ${det.kod}: nie wykonano pomiaru`);

  for (const z of konfig.testy.zapadka) {
    const przed = plan.pomiar_przed?.[z.klucz];
    const po = plan.pomiar_po?.[z.klucz];
    if (przed === undefined || po === undefined) {
      niesprawdzone.push(`zapadka "${z.klucz}": brak pomiaru przed albo po`);
      continue;
    }
    const porownaj = (nazwa, a, b) => {
      if (typeof a !== "number" || typeof b !== "number") { niesprawdzone.push(`zapadka "${nazwa}": wartość nie jest liczbą`); return; }
      if (z.kierunek === "nie_wzrasta" && b > a) naruszenia.push(`zapadka "${nazwa}": wzrosło (przed ${a}, po ${b})`);
      else if (z.kierunek === "nie_spada" && b < a) naruszenia.push(`zapadka "${nazwa}": spadło (przed ${a}, po ${b})`);
      else if (z.kierunek !== "nie_wzrasta" && z.kierunek !== "nie_spada") niesprawdzone.push(`zapadka "${nazwa}": nieznany kierunek ${z.kierunek}`);
    };
    if (typeof przed === "object" && typeof po === "object") {
      for (const k of Object.keys(przed)) {
        if (po[k] === undefined) niesprawdzone.push(`zapadka "${z.klucz}.${k}": brak w pomiarze po`);
        else porownaj(`${z.klucz}.${k}`, przed[k], po[k]);
      }
    } else porownaj(z.klucz, przed, po);
  }
  return { naruszenia, niesprawdzone, luki: luki.length };
}

function main(argv) {
  const opcje = { plan: null, config: null, repo: process.cwd() };
  for (const a of argv) {
    if (a.startsWith("--plan=")) opcje.plan = path.resolve(a.slice(7));
    else if (a.startsWith("--config=")) opcje.config = path.resolve(a.slice(9));
    else if (a.startsWith("--repo=")) opcje.repo = path.resolve(a.slice(7));
    else { process.stderr.write(`zły argument: ${a}\nużycie: bramka-testow-fali.mjs --plan=<plik.json> [--config=<plik>] [--repo=<dir>]\n`); return 2; }
  }
  const raport = (kod, wynik, extra = {}) => {
    process.stdout.write(JSON.stringify({ krok: "bramka-testow-fali", kod, wynik, ...extra }, null, 2) + "\n");
    return kod;
  };
  const brak = (msg) => raport(2, "BRAK POMIARU", { naruszenia: [], niesprawdzone: [msg] });
  if (!opcje.plan) return brak("brak --plan");
  const configPath = opcje.config ?? path.join(opcje.repo, ".claude", "projekt-heniek.json");
  let plan;
  let konfig;
  try { plan = JSON.parse(fs.readFileSync(opcje.plan, "utf8")); } catch (e) { return brak(`plan: ${e.message.split("\n")[0]}`); }
  try { konfig = JSON.parse(fs.readFileSync(configPath, "utf8")); } catch (e) { return brak(`konfiguracja ${configPath}: ${e.message.split("\n")[0]}`); }
  if (!konfig.testy || typeof konfig.testy !== "object") return brak(`konfiguracja ${configPath} nie ma obiektu "testy"`);
  if (!Array.isArray(konfig.testy.zapadka)) return brak(`konfiguracja ${configPath}: testy.zapadka musi być listą`);

  const { naruszenia, niesprawdzone, luki } = ocenPlan(plan, konfig, opcje.repo);
  const kod = naruszenia.length ? 1 : niesprawdzone.length ? 2 : 0;
  const wynik = kod === 0 ? "ZAMKNIETE" : kod === 1 ? "NARUSZENIE" : "BRAK POMIARU";
  for (const n of naruszenia) process.stderr.write(`NARUSZENIE ${n}\n`);
  return raport(kod, wynik, {
    fala: plan.fala ?? null,
    luki,
    naruszenia,
    niesprawdzone,
    nieweryfikowane: ["SHA jako przodek głowy: nie sprawdzane w tej wersji (sprawdzane tylko, czy pole jest niepuste)"],
    konfiguracja: configPath,
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = main(process.argv.slice(2));
}
