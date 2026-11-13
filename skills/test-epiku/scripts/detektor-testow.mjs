#!/usr/bin/env node
// detektor-testow.mjs - wykrywa EDYCJĘ i OSŁABIANIE istniejących testów w zakresie `baza...glowa` (test-epiku, bramka fali).
// Użycie:
//   node detektor-testow.mjs --baza=<ref> [--glowa=<ref>] [--repo=<katalog>] [--wyjatki=<plik>]
// Analizuje tylko pliki testowe (*.test.*, *.spec.*, test_*.py, *_test.py). Wykrywa:
//   usuniety_plik_testu            - plik testowy usunięty (linia 0 = cały plik)
//   zmieniona_lub_usunieta_asercja - linia z asercją usunięta albo zmieniona (tekst znika z pliku)
//   dodany_skip_lub_only           - dodane skip, fixme, only, todo, xit, pytest.mark.skip itp.
//   mniej_asercji                  - w pliku jest mniej linii z asercjami niż w bazie
// Parsuje diff (--unified=0, bez wykrywania przeniesień: zmiana nazwy testu to usunięcie + dodanie).
// Wyjątek: plik wpisany w liście z podanym powodem ("ścieżka | powód", linie zaczynające się od # są komentarzem).
// Wpis bez powodu NIE jest wyjątkiem (trafienie zostaje) i jest zgłoszony w wyjatki_bez_powodu.
// Wyjście: JSON na stdout {krok, kod, wynik, baza, glowa, pliki_testowe, trafienia, wyjatki_uzyte, wyjatki_bez_powodu, niesprawdzone}.
// Kody: 0 bez trafień, 1 trafienia (plik:linia), 2 brak pomiaru (zły ref, nie repozytorium git).
// Skrypt nic nie zapisuje, więc --sucho nie jest potrzebne.
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

export const WZORZEC_TESTOW = /\.(?:test|spec)\.[cm]?[jt]sx?$|(?:^|\/)test_[^/]*\.py$|_test\.py$/u;
export const ASERCJA = /(?:^|[^\w.])assert(?:\.\w+)?\s*\(|^\s*assert\s|\.assert[A-Z]\w*\s*\(|\bexpect\s*\(|\bt\.(?:ok|equal|same|deepEqual|match|throws|notEqual|strictEqual)\s*\(|\.(?:toBe|toEqual|toStrictEqual|toMatch|toThrow|toContain|toHaveLength|toBeTruthy|toBeFalsy|toBeNull|toBeDefined|toHaveBeenCalled)\w*\s*\(/u;
export const SKIP_LUB_ONLY = /\b(?:test|it|describe|suite|context|t)\.(?:skip|fixme|only|todo)\b|\b(?:xit|xtest|xdescribe|fit|fdescribe)\s*\(|\bpytest\.mark\.(?:skip|xfail)\w*|@unittest\.skip\w*|\bpytest\.skip\s*\(|\{[^}]*\bskip\s*:\s*(?:true|['"][^'"]*['"])/u;

/**
 * Parsuje wyjście `git diff --unified=0 --no-renames` dla plików testowych.
 * @returns {Map<string, {plik: string, usuniety: boolean, usuniete: {linia: number, tekst: string}[], dodane: {linia: number, tekst: string}[], pierwszaZmiana: number | null}>}
 */
export function parsujDiff(tekst, wzorzec = WZORZEC_TESTOW) {
  const pliki = new Map();
  let cur = null;
  let oldPath = null;
  let inHunk = false;
  let oldL = 0;
  let newL = 0;
  for (const l of tekst.split(/\r?\n/)) {
    if (l.startsWith("diff --git ")) { cur = null; inHunk = false; continue; }
    if (!inHunk && l.startsWith("--- ")) { oldPath = l === "--- /dev/null" ? null : l.slice(6).replace(/^a\//, ""); continue; }
    if (!inHunk && l.startsWith("+++ ")) {
      const newPath = l === "+++ /dev/null" ? null : l.slice(6).replace(/^b\//, "");
      const cel = newPath ?? oldPath;
      cur = cel && wzorzec.test(cel) ? (pliki.get(cel) ?? pliki.set(cel, { plik: cel, usuniety: false, usuniete: [], dodane: [], pierwszaZmiana: null }).get(cel)) : null;
      if (cur) cur.usuniety = newPath === null;
      continue;
    }
    const m = l.match(/^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
    if (m) { inHunk = true; oldL = Number(m[1]); newL = Number(m[2]); continue; }
    if (!inHunk || !cur) continue;
    if (l.startsWith("-")) { cur.usuniete.push({ linia: oldL, tekst: l.slice(1).trim() }); oldL++; }
    else if (l.startsWith("+")) {
      cur.dodane.push({ linia: newL, tekst: l.slice(1).trim() });
      if (cur.pierwszaZmiana === null) cur.pierwszaZmiana = newL;
      newL++;
    }
  }
  return pliki;
}

/** Wczytuje listę wyjątków: "ścieżka | powód". Zwraca {wazne: Map<plik, powód>, bezPowodu: string[]}. */
export function wczytajWyjatki(tekst) {
  const wazne = new Map();
  const bezPowodu = [];
  for (const raw of tekst.split(/\r?\n/)) {
    const l = raw.trim();
    if (!l || l.startsWith("#")) continue;
    const [plik, ...reszta] = l.split("|");
    const powod = reszta.join("|").trim();
    const sciezka = plik.trim().replace(/\\/g, "/");
    if (!powod) bezPowodu.push(sciezka);
    else wazne.set(sciezka, powod);
  }
  return { wazne, bezPowodu };
}

function git(repo, args) {
  return execFileSync("git", ["-C", repo, "-c", "core.quotepath=off", ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], maxBuffer: 256 * 1024 * 1024 });
}

function liczAsercje(tresc) {
  return tresc.split(/\r?\n/).filter((l) => ASERCJA.test(l)).length;
}

/** Główna analiza zakresu. Rzuca przy błędzie git (obsługuje to wywołujący). */
export function wykryj({ repo, baza, glowa, wyjatki }) {
  const mergeBase = git(repo, ["merge-base", baza, glowa]).trim();
  const diff = git(repo, ["diff", "--no-renames", "--no-color", "--unified=0", `${baza}...${glowa}`]);
  const pliki = parsujDiff(diff);
  const trafienia = [];
  for (const f of pliki.values()) {
    if (f.usuniety) {
      trafienia.push({ plik: f.plik, linia: 0, typ: "usuniety_plik_testu", tekst: "" });
      continue;
    }
    const dodaneTeksty = new Set(f.dodane.map((d) => d.tekst));
    for (const u of f.usuniete) {
      if (ASERCJA.test(u.tekst) && !dodaneTeksty.has(u.tekst)) trafienia.push({ plik: f.plik, linia: u.linia, typ: "zmieniona_lub_usunieta_asercja", tekst: u.tekst });
    }
    for (const d of f.dodane) {
      if (SKIP_LUB_ONLY.test(d.tekst)) trafienia.push({ plik: f.plik, linia: d.linia, typ: "dodany_skip_lub_only", tekst: d.tekst });
    }
    let przed = 0;
    try { przed = liczAsercje(git(repo, ["show", `${mergeBase}:${f.plik}`])); } catch { przed = 0; }
    const po = liczAsercje(git(repo, ["show", `${glowa}:${f.plik}`]));
    if (po < przed) trafienia.push({ plik: f.plik, linia: f.pierwszaZmiana ?? 1, typ: "mniej_asercji", tekst: `asercji w bazie ${przed}, w glowie ${po}` });
  }
  const uzyte = new Map();
  const zostaja = [];
  for (const t of trafienia) {
    if (wyjatki.wazne.has(t.plik)) {
      uzyte.set(t.plik, (uzyte.get(t.plik) ?? 0) + 1);
    } else zostaja.push(t);
  }
  zostaja.sort((a, b) => (a.plik < b.plik ? -1 : a.plik > b.plik ? 1 : a.linia - b.linia));
  return {
    trafienia: zostaja,
    wyjatki_uzyte: [...uzyte].map(([plik, n]) => ({ plik, powod: wyjatki.wazne.get(plik), trafienia: n })),
    pliki_testowe: pliki.size,
  };
}

function main(argv) {
  const opcje = { baza: null, glowa: "HEAD", repo: process.cwd(), wyjatki: null };
  for (const a of argv) {
    if (a.startsWith("--baza=")) opcje.baza = a.slice(7);
    else if (a.startsWith("--glowa=")) opcje.glowa = a.slice(8);
    else if (a.startsWith("--repo=")) opcje.repo = path.resolve(a.slice(7));
    else if (a.startsWith("--wyjatki=")) opcje.wyjatki = path.resolve(a.slice(10));
    else { process.stderr.write(`zły argument: ${a}\nużycie: detektor-testow.mjs --baza=<ref> [--glowa=<ref>] [--repo=<dir>] [--wyjatki=<plik>]\n`); return 2; }
  }
  const raport = (kod, wynik, extra) => {
    process.stdout.write(JSON.stringify({ krok: "detektor-testow", kod, wynik, baza: opcje.baza, glowa: opcje.glowa, ...extra }, null, 2) + "\n");
    return kod;
  };
  if (!opcje.baza) return raport(2, "BRAK POMIARU", { niesprawdzone: ["brak --baza"] });
  let wyjatki = { wazne: new Map(), bezPowodu: [] };
  if (opcje.wyjatki) {
    if (!fs.existsSync(opcje.wyjatki)) return raport(2, "BRAK POMIARU", { niesprawdzone: [`brak listy wyjątków: ${opcje.wyjatki}`] });
    wyjatki = wczytajWyjatki(fs.readFileSync(opcje.wyjatki, "utf8"));
  }
  let wynik;
  try {
    wynik = wykryj({ repo: opcje.repo, baza: opcje.baza, glowa: opcje.glowa, wyjatki });
  } catch (e) {
    return raport(2, "BRAK POMIARU", { niesprawdzone: [`git: ${e.message.split("\n")[0]}`] });
  }
  for (const t of wynik.trafienia) process.stderr.write(`${t.plik}:${t.linia} ${t.typ}${t.tekst ? ` "${t.tekst}"` : ""}\n`);
  const kod = wynik.trafienia.length ? 1 : 0;
  return raport(kod, kod ? "TRAFIENIA" : "CZYSTO", {
    pliki_testowe: wynik.pliki_testowe,
    trafienia: wynik.trafienia.map((t) => ({ plik: t.plik, linia: t.linia, typ: t.typ, tekst: t.tekst })),
    wyjatki_uzyte: wynik.wyjatki_uzyte,
    wyjatki_bez_powodu: wyjatki.bezPowodu,
    niesprawdzone: [],
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = main(process.argv.slice(2));
}
