#!/usr/bin/env node
/**
 * POKRYCIE-TESTOW — dla każdego pliku kodu produktu (bez testów): czy jest OSIĄGALNY z testów.
 *   E2E        — spec przeglądarkowy wchodzi (goto) na trasę App Routera, a plik leży w domknięciu
 *                importów tej trasy (layouty i pliki konwencji Next wliczone),
 *   PRZEKLIK   — scenariusz .feature z adresem na trasę, j.w.,
 *   JEDNOSTKOWE — plik leży w domknięciu importów testu jednostkowego.
 *
 * MIARA TO OSIĄGALNOŚĆ, NIE ZACHOWANIE. „Pokryty” znaczy: istnieje łańcuch importów albo
 * trasa od testu do pliku. Test może zaimportować moduł i nic o nim nie sprawdzić. Ten skrypt
 * nie zastępuje przeglądu testów ani kontroli negatywnej.
 *
 * Przeniesione z repozytorium produktu źródłowego (wersja uproszczona — lista pominięć w raporcie
 * przeniesienia). Ten plik jest też biblioteką: mapa-testow.mjs importuje z niego helpery.
 *
 * Konfiguracja: .claude/projekt-heniek.json w katalogu roboczym (--config=<plik> nadpisuje).
 * Klucze czytane przez ten skrypt (pod obiektem `testy`, chyba że zaznaczono inaczej):
 *   sciezki                       (główny, wymagany) — [{id, nazwa, kategoria, pliki:[glob], pliki_testowe, testy}]
 *   testy.katalogi_kodu           (wymagany) — prefiksy katalogów kodu, np. ["src/"]
 *   testy.wzorzec_testu           (wymagany) — regex (tekst) rozpoznający plik testu jednostkowego
 *   testy.katalog_tras            (wymagany) — katalog trasy App Routera, np. "src/app/"
 *   testy.katalogi_e2e            — prefiksy katalogów specow przeglądarkowych (pusty = oś E2E nieliczona)
 *   testy.wzorzec_specu           — regex specu E2E (domyślnie .spec.ts/js/mjs/cjs)
 *   testy.katalog_scenariuszy     — katalog plików .feature (pusty = oś PRZEKLIK nieliczona)
 *   testy.metki_klikane           — metki scenariuszy liczonych do PRZEKLIK (pusta lista = każdy scenariusz)
 *   testy.katalog_krokow          — katalog plików z definicjami krok(/regex/, …)
 *   testy.alias                   — mapa prefiksów importu, domyślnie {"@/": "src/"}
 *   testy.krytyczne_kategorie     — kategorie ścieżek; plik takiej ścieżki bez żadnego testu = NARUSZENIE
 *   testy.wyjatki_plik            — plik JSON [{plik, powod}] wyjęty z mianownika (pełne wyjątki)
 *   testy.mapa_sciezek            — plik JSON ze ścieżkami zamiast klucza `sciezki`
 *   testy.smoke                   — (dla mapa-testow.mjs) id ścieżek dokładane na poziomie fala
 *   testy.komenda_jednostkowych   — (dla mapa-testow.mjs) szablon z {pliki}
 *
 * Flagi: --config=<plik>  --sciezka=P1,P4  --status=E2E|PRZEKLIK|JEDNOSTKOWE|ZADEN|RAZEM
 *        --zapisz=<plik> (zapisuje wyłącznie pod jawnie podaną ścieżkę, raport markdown)  --sucho
 * Wyjście: zawsze JSON na stdout: {krok, kod, wynik, niesprawdzone}.
 * Kody: 0 = zmierzone, bez naruszeń; 1 = naruszenie (plik ścieżki krytycznej bez żadnego testu);
 *       2 = brak pomiaru albo zła konfiguracja (fail-closed: nic nie zgaduję, nigdy zielone).
 * Zależności: wyłącznie wbudowane moduły Node. Wymaga repozytorium git (lista plików: git ls-files).
 */
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const KOD = { ZIELONE: 0, NARUSZENIE: 1, BRAK: 2 };
export const PLIK_KONFIGU = ".claude/projekt-heniek.json";
export const MIARA = "osiagalnosc";
export const UWAGA_MIARY =
  "Mierzy OSIĄGALNOŚĆ (łańcuch importów albo trasa od testu do pliku), nie ZACHOWANIE. Plik osiągalny nie znaczy, że jego zachowanie jest sprawdzone.";

export class BladDanych extends Error {}

const ROZSZ_KODU = /\.(ts|tsx|js|jsx|mjs|cjs)$/;
const ROZSZ_IMPORTU = [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"];
const DOMYSLNY_WZORZEC_SPECU = "\\.spec\\.(ts|tsx|js|jsx|mjs|cjs)$";
const DOMYSLNE_KRYTYCZNE = ["pieniądze", "tożsamość i dostęp"];
const STATUSY_FILTRA = ["E2E", "PRZEKLIK", "JEDNOSTKOWE", "ZADEN", "RAZEM"];
const GLEBOKOSC_DOMENY = 2;

// ───────────────────────── wejście: flagi, glob, konfiguracja ─────────────────────────

/** `--nazwa=wartość` albo `--nazwa` (true). Nieznana flaga = błąd (fail-closed). */
export function sparsujFlagi(argv, dozwolone) {
  const flagi = new Map();
  for (const a of argv) {
    const m = a.match(/^--([a-z-]+)(?:=(.*))?$/);
    if (!m || !dozwolone.includes(m[1])) {
      throw new BladDanych(`nieznana flaga „${a}”; dozwolone: ${dozwolone.map((d) => "--" + d).join(", ")}`);
    }
    flagi.set(m[1], m[2] ?? true);
  }
  return flagi;
}

/** Wartość flagi tekstowej; `true` (flaga bez `=`) albo brak = wartość domyślna / błąd. */
export function tekstFlagi(flagi, nazwa, domyslna) {
  if (!flagi.has(nazwa)) return domyslna;
  const v = flagi.get(nazwa);
  if (v === true) throw new BladDanych(`--${nazwa} wymaga wartości: --${nazwa}=…`);
  return v;
}

export function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Glob -> RegExp. `**` = dowolne katalogi, `*` = fragment bez `/`, `?` = jeden znak, `{a,b}` = alternatywa.
 *  Nawiasy kwadratowe są dosłowne (`[locale]` to katalog o tej nazwie). */
export function globNaRegex(glob) {
  let out = "";
  let klamry = 0;
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    if (c === "*") {
      if (glob[i + 1] === "*") {
        if (glob[i + 2] === "/") {
          out += "(?:.*/)?";
          i += 2;
        } else {
          out += ".*";
          i += 1;
        }
      } else out += "[^/]*";
    } else if (c === "?") out += "[^/]";
    else if (c === "{") {
      klamry++;
      out += "(?:";
    } else if (c === "}" && klamry > 0) {
      klamry--;
      out += ")";
    } else if (c === "," && klamry > 0) out += "|";
    else out += escapeRegex(c);
  }
  return new RegExp("^" + out + "$");
}

export function kompilujGloby(globy) {
  const wzorce = (globy ?? []).map(globNaRegex);
  return (plik) => wzorce.some((r) => r.test(plik));
}

export function prefiks(s) {
  const t = String(s).replace(/\\/g, "/").replace(/^\.\//, "");
  return t.endsWith("/") ? t : t + "/";
}

function czytajJson(plik, opis) {
  let tekst;
  try {
    tekst = readFileSync(plik, "utf8");
  } catch (e) {
    throw new BladDanych(`${opis}: nie da się przeczytać ${plik} (${e.code ?? e.message})`);
  }
  try {
    return JSON.parse(tekst);
  } catch (e) {
    throw new BladDanych(`${opis}: ${plik} nie jest poprawnym JSON (${e.message})`);
  }
}

function listaZKonfigu(v, nazwa) {
  if (v === undefined || v === null) return [];
  if (!Array.isArray(v) || v.some((x) => typeof x !== "string")) throw new BladDanych(`${nazwa}: oczekiwana lista tekstów`);
  return v;
}

function regexZKonfigu(tekst, nazwa) {
  if (typeof tekst !== "string") throw new BladDanych(`${nazwa}: oczekiwany tekst (regex)`);
  try {
    return new RegExp(tekst);
  } catch (e) {
    throw new BladDanych(`${nazwa}: nieprawidłowy regex (${e.message})`);
  }
}

/**
 * Czyta konfigurację projektu i zwraca ustawienia znormalizowane (prefiksy ze znakiem `/`,
 * regexy skompilowane). Brak pliku, zły JSON, brak wymaganych kluczy = BladDanych (kod 2).
 */
export function wczytajKonfiguracje({ cwd, plikKonfigu }) {
  const sciezkaPliku = resolve(cwd, plikKonfigu || PLIK_KONFIGU);
  if (!existsSync(sciezkaPliku)) {
    throw new BladDanych(`brak konfiguracji ${plikKonfigu || PLIK_KONFIGU} (szukano: ${sciezkaPliku}); dodaj ją albo podaj --config=<plik>`);
  }
  const k = czytajJson(sciezkaPliku, "konfiguracja");
  const t = k?.testy;
  if (!t || typeof t !== "object") throw new BladDanych("konfiguracja: brak obiektu „testy”");

  const katalogiKodu = listaZKonfigu(t.katalogi_kodu, "testy.katalogi_kodu").map(prefiks);
  if (!katalogiKodu.length) throw new BladDanych("testy.katalogi_kodu: wymagana niepusta lista katalogów kodu");
  const wzorzecTestu = regexZKonfigu(t.wzorzec_testu, "testy.wzorzec_testu");

  let sciezki = k.sciezki;
  if (t.mapa_sciezek) {
    const p = resolve(cwd, t.mapa_sciezek);
    if (!existsSync(p)) throw new BladDanych(`testy.mapa_sciezek: brak pliku ${t.mapa_sciezek}`);
    const j = czytajJson(p, "mapa ścieżek");
    sciezki = Array.isArray(j) ? j : j?.sciezki;
  }
  if (!Array.isArray(sciezki) || !sciezki.length) throw new BladDanych("konfiguracja: brak niepustej listy „sciezki”");
  for (const s of sciezki) {
    if (!s || typeof s.id !== "string" || !Array.isArray(s.pliki) || !s.pliki.length) {
      throw new BladDanych(`ścieżka ${s?.id ?? "(bez id)"}: wymagane „id” i niepusta lista „pliki”`);
    }
  }

  return {
    sciezkaPliku,
    sciezki: sciezki.map((s) => ({
      id: s.id,
      nazwa: s.nazwa ?? s.id,
      kategoria: s.kategoria ?? "",
      pliki: s.pliki,
      pliki_testowe: s.pliki_testowe ?? [],
      testy: s.testy ?? []
    })),
    katalogiKodu,
    wzorzecTestu,
    katalogiE2E: listaZKonfigu(t.katalogi_e2e, "testy.katalogi_e2e").map(prefiks),
    wzorzecSpecu: regexZKonfigu(t.wzorzec_specu ?? DOMYSLNY_WZORZEC_SPECU, "testy.wzorzec_specu"),
    katalogTras: t.katalog_tras ? prefiks(t.katalog_tras) : "",
    katalogScenariuszy: t.katalog_scenariuszy ? prefiks(t.katalog_scenariuszy) : "",
    metkiKlikane: listaZKonfigu(t.metki_klikane, "testy.metki_klikane"),
    katalogKrokow: t.katalog_krokow ? prefiks(t.katalog_krokow) : "",
    alias: t.alias ?? { "@/": "src/" },
    smoke: listaZKonfigu(t.smoke, "testy.smoke"),
    krytyczne: (t.krytyczne_kategorie ?? DOMYSLNE_KRYTYCZNE).map((s) => String(s).toLowerCase()),
    komendaJednostkowych: typeof t.komenda_jednostkowych === "string" ? t.komenda_jednostkowych : "node --test {pliki}",
    wyjatkiPlik: t.wyjatki_plik ?? ""
  };
}

// ───────────────────────── pliki repozytorium ─────────────────────────

/** Wszystkie pliki repo (śledzone i nieśledzone, bez ignorowanych), które istnieją na dysku. */
export function listaPlikow(cwd) {
  const r = spawnSync("git", ["ls-files", "--cached", "--others", "--exclude-standard"], {
    cwd,
    encoding: "utf8",
    maxBuffer: 256 * 1024 * 1024
  });
  if (r.error || r.status !== 0) {
    throw new BladDanych(`nie da się wylistować plików git w ${cwd} (to repozytorium?): ${(r.stderr || r.error?.message || "").trim()}`);
  }
  const wynik = new Set();
  for (const linia of r.stdout.split(/\r?\n/)) {
    const p = linia.trim().replace(/\\/g, "/");
    if (p && existsSync(join(cwd, p))) wynik.add(p);
  }
  return [...wynik].sort();
}

export function czyKodu(plik, u) {
  return ROZSZ_KODU.test(plik) && u.katalogiKodu.some((p) => plik.startsWith(p));
}

export function czytajPliki(cwd, lista) {
  return lista.map((plik) => ({ plik, tresc: readFileSync(join(cwd, plik), "utf8") }));
}

// ───────────────────────── graf importów ─────────────────────────

const WZORCE_IMPORTU = [
  /\bimport\s+(?:[^'"]+?\s+from\s+)?["']([^"']+)["']/g,
  /\bexport\s+(?:[^'"]+?\s+from\s+)?["']([^"']+)["']/g,
  /\bimport\(\s*["']([^"']+)["']\s*\)/g,
  /\brequire\(\s*["']([^"']+)["']\s*\)/g
];

export function specyfikatoryImportu(tresc) {
  const wynik = new Set();
  for (const w of WZORCE_IMPORTU) for (const m of tresc.matchAll(w)) wynik.add(m[1]);
  return [...wynik];
}

function zlaczRelatywnie(zPliku, spec) {
  const katalog = zPliku.split("/").slice(0, -1);
  for (const cz of spec.split("/")) {
    if (cz === "." || cz === "") continue;
    if (cz === "..") katalog.pop();
    else katalog.push(cz);
  }
  return katalog.join("/");
}

/** Rozwiązuje specyfikator do pliku w zbiorze repo; null = pakiet zewnętrzny albo brak pliku. */
export function rozwiazImport(zPliku, spec, zbior, alias) {
  let baza;
  const prefiksAliasu = Object.keys(alias).find((p) => spec.startsWith(p));
  if (prefiksAliasu !== undefined) baza = alias[prefiksAliasu] + spec.slice(prefiksAliasu.length);
  else if (spec.startsWith("./") || spec.startsWith("../")) baza = zlaczRelatywnie(zPliku, spec);
  else return null;
  const kandydaci = [baza, ...ROZSZ_IMPORTU.map((e) => baza + e), ...ROZSZ_IMPORTU.map((e) => `${baza}/index${e}`)];
  return kandydaci.find((k) => zbior.has(k)) ?? null;
}

/** Graf: plik -> Set(plików importowanych, rozwiązanych w repo). */
export function zbudujGraf(pliki, alias) {
  const zbior = new Set(pliki.map((p) => p.plik));
  const graf = new Map();
  for (const { plik, tresc } of pliki) {
    const sasiedzi = new Set();
    for (const spec of specyfikatoryImportu(tresc)) {
      const cel = rozwiazImport(plik, spec, zbior, alias);
      if (cel && cel !== plik) sasiedzi.add(cel);
    }
    graf.set(plik, sasiedzi);
  }
  return graf;
}

/** Domknięcie przechodnie (BFS) z punktów startowych, włącznie z nimi. */
export function domkniecie(punkty, graf) {
  const odwiedzone = new Set();
  const stos = [...punkty];
  while (stos.length) {
    const p = stos.pop();
    if (odwiedzone.has(p)) continue;
    odwiedzone.add(p);
    for (const s of graf.get(p) ?? []) if (!odwiedzone.has(s)) stos.push(s);
  }
  return odwiedzone;
}

// ───────────────────────── trasy App Routera i pliki konwencji Next ─────────────────────────

const NAZWA_TRASY = /^(page|route)\.(ts|tsx|js|jsx)$/;
const NAZWY_KONWENCJI = ["layout", "loading", "error", "not-found", "global-error", "template", "default"];
const ROZSZ_KONWENCJI = [".tsx", ".ts", ".jsx", ".js"];

export function zbudujTrasy(pliki, katalogTras) {
  return pliki.flatMap((p) => {
    if (!p.startsWith(katalogTras)) return [];
    const czesci = p.slice(katalogTras.length).split("/");
    if (!NAZWA_TRASY.test(czesci.at(-1))) return [];
    const katalogi = czesci.slice(0, -1);
    return [{ plik: p, katalogi, segmentyUrl: katalogi.filter((s) => !/^\(.+\)$/.test(s)) }];
  });
}

function typSegmentu(seg) {
  if (/^\[\[\.\.\..+\]\]$/.test(seg)) return "catch-all-opcjonalny";
  if (/^\[\.\.\..+\]$/.test(seg)) return "catch-all";
  if (/^\[.+\]$/.test(seg)) return "dynamiczny";
  return "staly";
}

/** Dopasowanie segmentów adresu (`*` = nieznany fragment) do wzorca trasy; `spec` = swoistość. */
export function dopasujSegmenty(url, wzor) {
  let iu = 0;
  let spec = 0;
  for (const w of wzor) {
    const typ = typSegmentu(w);
    if (typ === "catch-all-opcjonalny") return { ok: true, spec: spec + 1 };
    if (typ === "catch-all") return iu >= url.length ? { ok: false } : { ok: true, spec: spec + 1 };
    if (iu >= url.length) return { ok: false };
    const u = url[iu];
    if (typ === "dynamiczny" || u === "*") spec += 1;
    else if (u !== w) return { ok: false };
    else spec += 3;
    iu++;
  }
  return iu === url.length ? { ok: true, spec } : { ok: false };
}

/** Najbardziej swoista trasa dla adresu; null gdy żadna nie pasuje. */
export function dopasujTrase(url, trasy) {
  let najlepsza = null;
  let najlepszaSpec = -1;
  for (const t of trasy) {
    const w = dopasujSegmenty(url, t.segmentyUrl);
    if (w.ok && w.spec > najlepszaSpec) {
      najlepsza = t;
      najlepszaSpec = w.spec;
    }
  }
  return najlepsza;
}

/** Pliki konwencji Next (layout i pliki specjalne) z każdego katalogu na drodze do trasy, tylko istniejące. */
export function plikiKonwencji(trasa, katalogTras, zbior) {
  const katalogi = [katalogTras.replace(/\/$/, "")];
  for (const seg of trasa.katalogi) katalogi.push(katalogi.at(-1) + "/" + seg);
  const wynik = [];
  for (const dir of katalogi) {
    for (const nazwa of NAZWY_KONWENCJI) {
      for (const ext of ROZSZ_KONWENCJI) {
        const k = `${dir}/${nazwa}${ext}`;
        if (zbior.has(k)) wynik.push(k);
      }
    }
  }
  return wynik;
}

// ───────────────────────── adresy z testów (spec E2E, kroki, scenariusze) ─────────────────────────

const WZORZEC_NAWIGACJI = /\.goto\(\s*|\brequest\.(?:get|post|put|patch|delete|head|fetch)\(\s*/g;
const RE_TEKST = /^(?:"((?:[^"\\]|\\.)*)"|'((?:[^'\\]|\\.)*)')$/;
const RE_IDENT = /^[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*$/;

function policzLinie(tresc, indeks) {
  let n = 1;
  for (let i = 0; i < indeks; i++) if (tresc.charCodeAt(i) === 10) n++;
  return n;
}

/** Czyta wyrażenie od `start` do pierwszego znaku z `stopy` na głębokości 0 (poza cudzysłowem). */
function wezWyrazenie(tresc, start, stopy) {
  let glebia = 0;
  let q = null;
  let i = start;
  for (; i < tresc.length; i++) {
    const c = tresc[i];
    if (q) {
      if (c === "\\") i++;
      else if (c === q) q = null;
      continue;
    }
    if (c === '"' || c === "'" || c === "`") q = c;
    else if ("([{".includes(c)) glebia++;
    else if (")]}".includes(c)) {
      if (glebia === 0) break;
      glebia--;
    } else if (glebia === 0 && stopy.includes(c)) break;
  }
  return tresc.slice(start, i).trim();
}

/** Dzieli wyrażenie po `+` na poziomie zero (poza literałami). */
function podzielPlus(s) {
  const czesci = [];
  let cur = "";
  let q = null;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (q) {
      cur += c;
      if (c === "\\") cur += s[++i] ?? "";
      else if (c === q) q = null;
      continue;
    }
    if (c === '"' || c === "'" || c === "`") {
      q = c;
      cur += c;
    } else if (c === "+") {
      czesci.push(cur);
      cur = "";
    } else cur += c;
  }
  czesci.push(cur);
  return czesci;
}

/** Stałe `const NAZWA = wyrażenie` z tekstu (bez rozwijania wywołań funkcji). */
export function stalePlikow(tresc) {
  const stale = new Map();
  for (const m of tresc.matchAll(/\bconst\s+([A-Za-z_$][\w$]*)\s*(?::[^=\n]+)?=\s*/g)) {
    stale.set(m[1], wezWyrazenie(tresc, m.index + m[0].length, ";\n"));
  }
  return stale;
}

/**
 * Ocenia wyrażenie adresu do wzorca tekstowego. Zwraca string (nieznane fragmenty = `*`,
 * parametry kroku = `{nazwa}`), albo null gdy wyrażenia nie da się rozwiązać.
 */
export function ocenWyrazenie(wyr, kontekst, glebokosc = 0) {
  if (glebokosc > 5) return null;
  let wynik = "";
  for (const czesc of podzielPlus(wyr)) {
    const c = czesc.trim();
    const lit = RE_TEKST.exec(c);
    if (lit) {
      wynik += lit[1] ?? lit[2];
      continue;
    }
    if (c.length >= 2 && c.startsWith("`") && c.endsWith("`")) {
      wynik += c
        .slice(1, -1)
        .replace(/\$\{([^}]*)\}/g, (_, e) => ocenWyrazenie(e.trim(), kontekst, glebokosc + 1) ?? "*");
      continue;
    }
    if (RE_IDENT.test(c)) {
      if (/baseURL$/.test(c)) continue; // origin aplikacji, nie ścieżka
      if (kontekst.parametry?.has(c)) {
        wynik += `{${c}}`;
        continue;
      }
      if (kontekst.stale?.has(c)) {
        const v = ocenWyrazenie(kontekst.stale.get(c), kontekst, glebokosc + 1);
        if (v === null) return null;
        wynik += v;
        continue;
      }
    }
    return null;
  }
  return wynik;
}

/** Normalizuje wzorzec adresu. null = nie jest adresem tej aplikacji; {zewnetrzny:true} = pomiń. */
export function normalizujAdres(wzorzec) {
  if (/^https?:\/\//i.test(wzorzec)) {
    if (!/^https?:\/\/(localhost|127\.0\.0\.1)/i.test(wzorzec)) return { zewnetrzny: true };
    wzorzec = wzorzec.replace(/^https?:\/\/[^/]+/i, "");
  }
  let bez = wzorzec.split("?")[0].split("#")[0].replace(/<[^>]*>/g, "*");
  if (bez === "") bez = "/";
  if (!bez.startsWith("/")) return null;
  const segmenty = bez.split("/").filter(Boolean);
  return { pelny: "/" + segmenty.join("/"), segmenty };
}

/** Wywołania nawigacji (`.goto(`, `request.get(` …) w tekście: adresy i nierozwiązane. */
function adresyNawigacji(tresc, kontekst) {
  const adresy = [];
  const nierozwiazane = [];
  for (const m of tresc.matchAll(WZORZEC_NAWIGACJI)) {
    const start = m.index + m[0].length;
    const arg = wezWyrazenie(tresc, start, ",)");
    const linia = policzLinie(tresc, m.index);
    const wzorzec = ocenWyrazenie(arg, kontekst);
    if (wzorzec === null) {
      nierozwiazane.push({ linia, powod: `argument nawigacji „${arg}” nie jest literałem ani znaną stałą` });
      continue;
    }
    const n = normalizujAdres(wzorzec);
    if (n === null) nierozwiazane.push({ linia, powod: `adres „${wzorzec}” nie zaczyna się od „/”` });
    else if (!n.zewnetrzny) adresy.push(n);
  }
  return { adresy, nierozwiazane };
}

/** Adresy z pliku specu E2E (cały plik; ziarnistość = plik). */
export function adresyZSpeca(tresc) {
  const kontekst = { stale: stalePlikow(tresc), parametry: new Set() };
  return adresyNawigacji(tresc, kontekst);
}

function zamykajacaKlamra(tresc, od) {
  let g = 1;
  for (let i = od; i < tresc.length; i++) {
    if (tresc[i] === "{") g++;
    else if (tresc[i] === "}" && --g === 0) return i;
  }
  return tresc.length;
}

/** Definicje kroków `krok(/regex/, async (swiat, p1, …) => { … })`; adresy z ciała, parametry jako `{nazwa}`. */
export function definicjeKrokow(tresc) {
  const stale = stalePlikow(tresc);
  const defs = [];
  for (const m of tresc.matchAll(/\bkrok\(\s*\/((?:\\.|[^/\\])*)\/([a-z]*)\s*,/g)) {
    let re;
    try {
      re = new RegExp(m[1], m[2]);
    } catch {
      continue;
    }
    const od = m.index + m[0].length;
    const naglowek = tresc.slice(od).match(/^\s*(?:async\s*)?\(\s*([^)]*)\)\s*=>\s*\{/);
    if (!naglowek) continue;
    const parametry = naglowek[1]
      .split(",")
      .map((s) => s.trim().split(/[:=]/)[0].trim())
      .filter(Boolean)
      .slice(1);
    const poczatek = od + naglowek[0].length;
    const cialo = tresc.slice(poczatek, zamykajacaKlamra(tresc, poczatek));
    const kontekst = { stale: new Map([...stale, ...stalePlikow(cialo)]), parametry: new Set(parametry) };
    // surowe wzorce (z `{nazwa}` dla parametrów), normalizacja dopiero po podstawieniu wartości kroku
    const adresy = [];
    const nierozwiazane = [];
    for (const w of cialo.matchAll(WZORZEC_NAWIGACJI)) {
      const arg = wezWyrazenie(cialo, w.index + w[0].length, ",)");
      const wzorzec = ocenWyrazenie(arg, kontekst);
      if (wzorzec === null) nierozwiazane.push(`argument nawigacji „${arg}” nie jest literałem ani znaną stałą`);
      else if (!/^https?:\/\//i.test(wzorzec)) adresy.push(wzorzec);
    }
    defs.push({ re, parametry, adresy, nierozwiazane });
  }
  return defs;
}

const WZOR_KROKU = /^(?:Zakładając,?\s*że|Zakładając|Mając|Kiedy|Gdy|Wtedy|Wówczas|Oraz|I|Ale)\s+(.+)$/u;

/** Czy scenariusz z metką klikaną istnieje (metki dziedziczone z `Funkcja:`); pusta lista = każdy plik liczy się. */
export function czyFeatureKlikany(tresc, metkiKlikane) {
  if (!metkiKlikane.length) return true;
  let oczekujace = [];
  let metkiFunkcji = [];
  for (const surowa of tresc.split(/\r?\n/)) {
    const linia = surowa.trim();
    if (!linia || linia.startsWith("#")) continue;
    if (linia.startsWith("@")) {
      oczekujace.push(...linia.split(/\s+/).filter((m) => m.startsWith("@")));
      continue;
    }
    if (/^Funkcja:/u.test(linia)) {
      metkiFunkcji = oczekujace;
      oczekujace = [];
      continue;
    }
    if (/^(?:Scenariusz|Przykład):/u.test(linia)) {
      if ([...metkiFunkcji, ...oczekujace].some((m) => metkiKlikane.includes(m))) return true;
      oczekujace = [];
    }
  }
  return false;
}

/** Adresy z pliku .feature: cytowane `"/adres"` albo dopasowanie kroku do definicji z `katalog_krokow`. */
export function adresyZFeature(tresc, defs) {
  const adresy = [];
  const nierozwiazane = [];
  tresc.split(/\r?\n/).forEach((surowa, idx) => {
    const m = surowa.trim().match(WZOR_KROKU);
    if (!m) return;
    const tekst = m[1];
    const linia = idx + 1;
    const bezposrednie = [...tekst.matchAll(/"([^"]*)"/g)].map((x) => x[1]).filter((s) => s.startsWith("/"));
    if (bezposrednie.length) {
      for (const b of bezposrednie) {
        const n = normalizujAdres(b);
        if (n && !n.zewnetrzny) adresy.push(n);
      }
      return;
    }
    let dopasowano = false;
    for (const def of defs) {
      const dop = tekst.match(def.re);
      if (!dop) continue;
      dopasowano = true;
      const wartosci = dop.slice(1);
      for (const powod of def.nierozwiazane) nierozwiazane.push({ linia, powod: `krok bez rozwiązanego adresu: ${powod}` });
      for (const a of def.adresy) {
        const podstawiony = a.replace(/\{([^}]+)\}/g, (c, nazwa) => {
          const i = def.parametry.indexOf(nazwa);
          return i >= 0 ? wartosci[i] ?? "*" : c;
        });
        const n = normalizujAdres(podstawiony);
        if (n && !n.zewnetrzny) adresy.push(n);
        else if (!n) nierozwiazane.push({ linia, powod: `krok dopasowany, adres „${podstawiony}” nie jest ścieżką` });
      }
    }
    if (!dopasowano && /^(?:wchodzę|wchodzi|otwieram|otwiera|przechodzę)\b/u.test(tekst)) {
      nierozwiazane.push({ linia, powod: "wygląda na nawigację, ale żaden zarejestrowany krok jej nie tłumaczy na adres" });
    }
  });
  return { adresy, nierozwiazane };
}

// ───────────────────────── pomiar ─────────────────────────

const ETYKIETY_OSI = { E2E: "E2E", PRZEKLIK: "PRZEKLIK", JEDNOSTKOWE: "JEDNOSTKOWE" };

export function statusWiersza(w) {
  const aktywne = [];
  if (w.e2e.length) aktywne.push(ETYKIETY_OSI.E2E);
  if (w.przeklik.length) aktywne.push(ETYKIETY_OSI.PRZEKLIK);
  if (w.jednostkowe.length) aktywne.push(ETYKIETY_OSI.JEDNOSTKOWE);
  if (!aktywne.length) return "ZADEN";
  if (aktywne.length === 3) return "RAZEM";
  return aktywne.join("+");
}

export function podsumuj(wiersze) {
  const razem = wiersze.length;
  const proc = (n) => (razem ? Math.round((n / razem) * 1000) / 10 : 0);
  const e2e = wiersze.filter((w) => w.e2e.length).length;
  const przeklik = wiersze.filter((w) => w.przeklik.length).length;
  const jednostkowe = wiersze.filter((w) => w.jednostkowe.length).length;
  const zaden = wiersze.filter((w) => statusWiersza(w) === "ZADEN").length;
  return {
    razem,
    e2e,
    przeklik,
    jednostkowe,
    zaden,
    procentE2E: proc(e2e),
    procentPrzeklik: proc(przeklik),
    procentJednostkowe: proc(jednostkowe),
    procentZadenBrak: proc(zaden)
  };
}

function dopasujFiltrStatusu(w, filtr) {
  const st = statusWiersza(w);
  if (filtr === "ZADEN") return st === "ZADEN";
  if (filtr === "RAZEM") return st === "RAZEM";
  return st.split("+").includes(filtr);
}

/** Raport markdown; nagłówek mówi wprost, że mierzy osiągalność. */
export function formatujMarkdown(w) {
  const l = [];
  l.push("# Pokrycie testami: OSIĄGALNOŚĆ, nie zachowanie", "");
  l.push(`Miara: ${MIARA}. ${UWAGA_MIARY}`, "");
  l.push(`Konfiguracja: ${w.konfiguracja}`, "");
  const p = w.podsumowanie;
  l.push(
    `Podsumowanie: ${p.razem} plików kodu; E2E ${p.e2e} (${p.procentE2E}%), PRZEKLIK ${p.przeklik} (${p.procentPrzeklik}%), ` +
      `JEDNOSTKOWE ${p.jednostkowe} (${p.procentJednostkowe}%), ZADEN ${p.zaden} (${p.procentZadenBrak}%).`,
    ""
  );
  if (w.niesprawdzone.length) l.push("## Niesprawdzone", "", ...w.niesprawdzone.map((n) => `- ${n}`), "");
  l.push("| Plik | Status | Ścieżki | E2E | PRZEKLIK | JEDNOSTKOWE |", "|---|---|---|---|---|---|");
  for (const r of w.pliki) {
    l.push(`| ${r.plik} | ${r.status} | ${r.sciezki.join(", ") || "-"} | ${r.e2e.length} | ${r.przeklik.length} | ${r.jednostkowe.length} |`);
  }
  return l.join("\n") + "\n";
}

function uruchomPokrycie(argv, cwd) {
  const flagi = sparsujFlagi(argv, ["config", "sciezka", "status", "zapisz", "sucho"]);
  const sucho = flagi.has("sucho");
  const u = wczytajKonfiguracje({ cwd, plikKonfigu: tekstFlagi(flagi, "config", "") || undefined });
  const niesprawdzone = [];

  const filtrSciezek = flagi.has("sciezka")
    ? tekstFlagi(flagi, "sciezka", "")
        .toUpperCase()
        .split(",")
        .map((s) => s.trim())
    : null;
  if (filtrSciezek) {
    const nieznane = filtrSciezek.filter((id) => !u.sciezki.some((s) => s.id.toUpperCase() === id));
    if (nieznane.length || !filtrSciezek.length) {
      throw new BladDanych(`--sciezka: nieznane ${nieznane.join(",") || "(puste)"}; są: ${u.sciezki.map((s) => s.id).join(", ")}`);
    }
  }
  const filtrStatusu = flagi.has("status") ? tekstFlagi(flagi, "status", "").toUpperCase() : null;
  if (filtrStatusu !== null && !STATUSY_FILTRA.includes(filtrStatusu)) {
    throw new BladDanych(`--status: „${filtrStatusu}” nie jest jednym z ${STATUSY_FILTRA.join(", ")}`);
  }
  const zapisz = flagi.has("zapisz") ? tekstFlagi(flagi, "zapisz", "") : null;
  if (zapisz === "") throw new BladDanych("--zapisz= jest puste: podaj ścieżkę pliku raportu");

  const pliki = listaPlikow(cwd);
  const kodu = pliki.filter((p) => czyKodu(p, u));
  const produkcyjne = kodu.filter((p) => !u.wzorzecTestu.test(p));
  const testyJedn = kodu.filter((p) => u.wzorzecTestu.test(p));
  const specy = u.katalogiE2E.length
    ? pliki.filter((p) => u.katalogiE2E.some((k) => p.startsWith(k)) && u.wzorzecSpecu.test(p))
    : [];
  if (!u.katalogiE2E.length) niesprawdzone.push("oś E2E nieliczona: brak testy.katalogi_e2e w konfiguracji");
  const featury = u.katalogScenariuszy
    ? pliki.filter((p) => p.startsWith(u.katalogScenariuszy) && p.endsWith(".feature"))
    : [];
  if (!u.katalogScenariuszy) niesprawdzone.push("oś PRZEKLIK nieliczona: brak testy.katalog_scenariuszy w konfiguracji");
  if (!produkcyjne.length) throw new BladDanych("zero plików kodu produktu w testy.katalogi_kodu: nic do policzenia");
  if (!u.katalogTras) throw new BladDanych("brak testy.katalog_tras: bez tras nie da się wskazać adresów E2E/PRZEKLIK");

  const wyjatki = u.wyjatkiPlik ? listaWyjatkow(cwd, u.wyjatkiPlik, produkcyjne) : [];
  const wyjatkiZbior = new Set(wyjatki.map((w) => w.plik));
  const mianownik = produkcyjne.filter((p) => !wyjatkiZbior.has(p));
  const mianownikZbior = new Set(mianownik);
  if (!mianownik.length) throw new BladDanych("wszystkie pliki kodu są wyjątkami: zero w mianowniku");

  const trasy = zbudujTrasy(pliki, u.katalogTras);
  if (!trasy.length) throw new BladDanych(`zero tras w ${u.katalogTras} (page/route): sprawdź testy.katalog_tras`);
  const zbiorKodu = new Set(kodu);
  const graf = zbudujGraf(czytajPliki(cwd, kodu), u.alias);
  const cacheTras = new Map();
  const domknieciaTrasy = (trasa) => {
    if (!cacheTras.has(trasa.plik)) {
      cacheTras.set(trasa.plik, domkniecie([trasa.plik, ...plikiKonwencji(trasa, u.katalogTras, zbiorKodu)], graf));
    }
    return cacheTras.get(trasa.plik);
  };

  const pokrycieE2E = new Map();
  const pokryciePrzeklik = new Map();
  const pokrycieJedn = new Map();
  const dodaj = (mapa, klucz, test) => {
    if (!mianownikZbior.has(klucz)) return;
    if (!mapa.has(klucz)) mapa.set(klucz, new Set());
    mapa.get(klucz).add(test);
  };
  const nierozwiazaneOdwolania = [];
  const przypnijAdresy = (zrodlo, adresy, mapa) => {
    for (const adres of adresy) {
      const trasa = dopasujTrase(adres.segmenty, trasy);
      if (!trasa) {
        nierozwiazaneOdwolania.push({ plik: zrodlo, powod: `adres „${adres.pelny}” nie pasuje do żadnej trasy pod ${u.katalogTras}` });
        continue;
      }
      for (const p of domknieciaTrasy(trasa)) dodaj(mapa, p, zrodlo);
    }
  };

  for (const spec of specy) {
    const { adresy, nierozwiazane } = adresyZSpeca(readFileSync(join(cwd, spec), "utf8"));
    nierozwiazaneOdwolania.push(...nierozwiazane.map((n) => ({ plik: `${spec}:${n.linia}`, powod: n.powod })));
    przypnijAdresy(spec, adresy, pokrycieE2E);
  }

  const defs = u.katalogKrokow
    ? pliki
        .filter((p) => p.startsWith(u.katalogKrokow) && ROZSZ_KODU.test(p))
        .flatMap((p) => definicjeKrokow(readFileSync(join(cwd, p), "utf8")))
    : [];
  const klikane = featury.filter((f) => czyFeatureKlikany(readFileSync(join(cwd, f), "utf8"), u.metkiKlikane));
  const featuryBezAdresow = [];
  for (const f of klikane) {
    const { adresy, nierozwiazane } = adresyZFeature(readFileSync(join(cwd, f), "utf8"), defs);
    nierozwiazaneOdwolania.push(...nierozwiazane.map((n) => ({ plik: `${f}:${n.linia}`, powod: n.powod })));
    if (!adresy.length) featuryBezAdresow.push(f);
    przypnijAdresy(f, adresy, pokryciePrzeklik);
  }
  if (featuryBezAdresow.length) {
    niesprawdzone.push(
      `PRZEKLIK: ${featuryBezAdresow.length} plików .feature bez żadnego adresu (brak cytowanego "/adresu" i brak definicji kroku w testy.katalog_krokow): nie da się ich przypisać do tras`
    );
  }

  for (const t of testyJedn) {
    for (const p of domkniecie([t], graf)) if (p !== t) dodaj(pokrycieJedn, p, t);
  }

  const wszystkieWiersze = mianownik.map((plik) => ({
    plik,
    sciezki: u.sciezki.filter((s) => kompilujGloby(s.pliki)(plik)).map((s) => s.id),
    e2e: [...(pokrycieE2E.get(plik) ?? [])].sort(),
    przeklik: [...(pokryciePrzeklik.get(plik) ?? [])].sort(),
    jednostkowe: [...(pokrycieJedn.get(plik) ?? [])].sort()
  }));
  for (const w of wszystkieWiersze) w.status = statusWiersza(w);

  const testyRazem = specy.length + klikane.length + testyJedn.length;
  if (testyRazem === 0) throw new BladDanych("zero testów (E2E, PRZEKLIK i jednostkowe): nie ma czego mierzyć");

  // zakres widoczny (filtr ścieżki) i naruszenia liczone na zakresie ścieżki, nie na filtrze statusu
  const zakresSciezki = filtrSciezek
    ? wszystkieWiersze.filter((w) => w.sciezki.some((id) => filtrSciezek.includes(id.toUpperCase())))
    : wszystkieWiersze;
  const krytyczneId = new Set(u.sciezki.filter((s) => u.krytyczne.includes(String(s.kategoria).toLowerCase())).map((s) => s.id));
  const naruszenia = zakresSciezki
    .filter((w) => w.status === "ZADEN" && w.sciezki.some((id) => krytyczneId.has(id)))
    .map((w) => ({ plik: w.plik, sciezki: w.sciezki, powod: "plik ścieżki krytycznej bez żadnego testu (E2E, PRZEKLIK, JEDNOSTKOWE)" }));

  const widoczne = (filtrStatusu ? zakresSciezki.filter((w) => dopasujFiltrStatusu(w, filtrStatusu)) : zakresSciezki);
  const nierozwNaZakresie = nierozwiazaneOdwolania;

  const domeny = new Map();
  for (const w of zakresSciezki) {
    const g = w.plik.split("/").slice(0, GLEBOKOSC_DOMENY).join("/");
    if (!domeny.has(g)) domeny.set(g, []);
    domeny.get(g).push(w);
  }

  if (nierozwNaZakresie.length) {
    niesprawdzone.push(`nierozwiązane odwołania w testach: ${nierozwNaZakresie.length} (nie liczą się jako pokrycie), np. ${nierozwNaZakresie[0].plik}: ${nierozwNaZakresie[0].powod}`);
  }
  if (wyjatki.length) niesprawdzone.push(`wyjątki poza mianownikiem: ${wyjatki.length} (testy.wyjatki_plik)`);

  const wynik = {
    miara: MIARA,
    uwagaMiary: UWAGA_MIARY,
    konfiguracja: relative(cwd, u.sciezkaPliku).replace(/\\/g, "/"),
    podsumowanie: podsumuj(zakresSciezki),
    domeny: [...domeny.entries()].map(([nazwa, lista]) => ({ nazwa, ...podsumuj(lista) })),
    pliki: widoczne.map((w) => ({ plik: w.plik, status: w.status, sciezki: w.sciezki, e2e: w.e2e, przeklik: w.przeklik, jednostkowe: w.jednostkowe })),
    wyjatki: wyjatki.map((w) => ({ plik: w.plik, powod: w.powod })),
    naruszenia,
    nierozwiazaneOdwolania: nierozwNaZakresie
  };

  if (sucho) {
    return {
      kod: KOD.ZIELONE,
      wynik: {
        sucho: true,
        konfiguracja: wynik.konfiguracja,
        plikiKoduProdukcyjnego: mianownik.length,
        trasy: trasy.length,
        specyE2E: specy.length,
        scenariuszeFeature: klikane.length,
        testyJednostkowe: testyJedn.length,
        zapisZ: zapisz ?? null,
        nic: "tryb --sucho: konfiguracja i wejście wczytane, pomiar pominięty, nic nie zapisano"
      },
      niesprawdzone: [...niesprawdzone, "tryb --sucho: pomiar pominięty"]
    };
  }

  if (zapisz !== null) writeFileSync(zapisz, formatujMarkdown({ ...wynik, niesprawdzone }));
  return {
    kod: naruszenia.length ? KOD.NARUSZENIE : KOD.ZIELONE,
    wynik: zapisz !== null ? { ...wynik, zapisanoDo: zapisz } : wynik,
    niesprawdzone
  };
}

/** Wyjątki pełne: JSON [{plik, powod}]; każdy wpis musi wskazywać istniejący plik kodu produktu. */
function listaWyjatkow(cwd, plikWyjatkow, produkcyjne) {
  const p = resolve(cwd, plikWyjatkow);
  if (!existsSync(p)) return [];
  const j = czytajJson(p, "wyjątki pokrycia");
  if (!Array.isArray(j)) throw new BladDanych("wyjątki pokrycia: oczekiwana lista [{plik, powod}]");
  const nieznane = j.filter((w) => !produkcyjne.includes(w?.plik)).map((w) => w?.plik);
  if (nieznane.length) throw new BladDanych(`wyjątki: wpisy wskazujące na nieistniejący plik kodu produktu: ${nieznane.join(", ")}`);
  return j;
}

/** Czy ten plik jest uruchomiony bezpośrednio (a nie zaimportowany przez test). */
export function jestUruchomionyBezposrednio(url) {
  return process.argv[1] && resolve(process.argv[1]) === fileURLToPath(url);
}

/** Wspólna powłoka CLI: zawsze JSON na stdout, każdy błąd = kod 2 (fail-closed). */
export function wykonajCli(krok, fn) {
  let wynik;
  try {
    wynik = fn(process.argv.slice(2), process.cwd());
  } catch (e) {
    const opis = e instanceof BladDanych ? e.message : `wyjątek nieoczekiwany: ${e.message}`;
    wynik = { kod: KOD.BRAK, wynik: null, niesprawdzone: [`${opis}. NIC nie zostało zmierzone.`] };
  }
  process.stdout.write(JSON.stringify({ krok, kod: wynik.kod, wynik: wynik.wynik ?? null, niesprawdzone: wynik.niesprawdzone ?? [] }, null, 2) + "\n");
  return wynik.kod;
}

if (jestUruchomionyBezposrednio(import.meta.url)) {
  process.exitCode = wykonajCli("pokrycie-testow", uruchomPokrycie);
}
