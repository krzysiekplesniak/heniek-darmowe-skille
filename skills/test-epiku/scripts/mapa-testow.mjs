#!/usr/bin/env node
/**
 * MAPA-TESTOW — zmienione pliki -> które testy uruchomić: jednostkowe (sąsiedzi, importujący,
 * przechodnio na poziomie fala), ścieżki krytyczne dotknięte zmianą, ich komendy i pliki testowe.
 * Heurystyka ZAKRESU: „co najpierw odpalić”, nie dowód „reszta jest zielona” i nie pomiar pokrycia.
 *
 *   node <katalog-skilla>/scripts/mapa-testow.mjs --baza=origin/main
 *   node <katalog-skilla>/scripts/mapa-testow.mjs --pliki=src/lib/a.ts,src/features/b.tsx --poziom=task
 *   git diff --name-only main | node <katalog-skilla>/scripts/mapa-testow.mjs --stdin --poziom=wydanie
 *
 * Przeniesione z repozytorium produktu źródłowego (wersja uproszczona — lista pominięć w raporcie
 * przeniesienia). Konfiguracja i graf importów: pokrycie-testow.mjs (ten sam katalog, import helperów).
 *
 * Konfiguracja: .claude/projekt-heniek.json (--config=<plik> nadpisuje). Używane klucze:
 *   sciezki (+ pliki, pliki_testowe, testy, kategoria), testy.katalogi_kodu, testy.wzorzec_testu,
 *   testy.katalogi_e2e, testy.wzorzec_specu, testy.smoke, testy.komenda_jednostkowych,
 *   testy.krytyczne_kategorie, testy.alias, testy.mapa_sciezek, nie_sciezki (opcjonalnie).
 *
 * Flagi: --baza=<ref> | --pliki=a,b | --stdin (dokładnie jedno źródło listy)
 *        --poziom=task|fala|wydanie (domyślnie fala)  --bez-smoke  --sucho  --config=<plik>
 * Wyjście: zawsze JSON na stdout: {krok, kod, wynik, niesprawdzone}.
 * Kody: 0 = wynik wyliczony; 1 = naruszenie (zmieniony plik ścieżki krytycznej, bez żadnego testu
 *       jednostkowego obok ani w grafie importów); 2 = błąd użycia, zła konfiguracja, zero plików
 *       testów albo pusta lista zmian (fail-closed: nic nie zgaduję).
 * Plik bez ścieżki krytycznej nie jest „bez ryzyka”: trafia do `nieprzypisane` i do `niesprawdzone`.
 */
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import {
  BladDanych,
  KOD,
  czyKodu,
  czytajPliki,
  domkniecie,
  kompilujGloby,
  listaPlikow,
  sparsujFlagi,
  tekstFlagi,
  wczytajKonfiguracje,
  wykonajCli,
  zbudujGraf,
  jestUruchomionyBezposrednio
} from "./pokrycie-testow.mjs";

export const POZIOMY = ["task", "fala", "wydanie"];

function czyTestowy(plik, u) {
  return u.wzorzecTestu.test(plik);
}

/** Sąsiedzi: `foo.ts` -> `foo.test.*` i `foo.<cokolwiek>.test.*` w tym samym katalogu. */
export function sasiedziTestow(plik, testy) {
  const i = plik.lastIndexOf("/");
  const katalog = plik.slice(0, i + 1);
  const nazwa = plik.slice(i + 1);
  const kropka = nazwa.lastIndexOf(".");
  const rdzen = kropka > 0 ? nazwa.slice(0, kropka) : nazwa;
  return testy.filter((p) => {
    if (!p.startsWith(katalog) || p.slice(katalog.length).includes("/")) return false;
    const n = p.slice(katalog.length);
    return n.startsWith(`${rdzen}.test.`) || (n.startsWith(`${rdzen}.`) && n !== nazwa);
  });
}

function odwrocGraf(graf) {
  const odwrotny = new Map();
  for (const [plik, sasiedzi] of graf) {
    for (const s of sasiedzi) {
      if (!odwrotny.has(s)) odwrotny.set(s, new Set());
      odwrotny.get(s).add(plik);
    }
  }
  return odwrotny;
}

function normalizujWejscie(surowe) {
  return [...new Set(surowe.map((s) => s.trim().replace(/\\/g, "/").replace(/^\.\//, "")).filter(Boolean))].sort();
}

function cytuj(p) {
  return /\s/.test(p) ? `"${p}"` : p;
}

function uruchomMape(argv, cwd) {
  const flagi = sparsujFlagi(argv, ["config", "baza", "pliki", "stdin", "poziom", "bez-smoke", "sucho"]);
  const poziom = tekstFlagi(flagi, "poziom", "fala");
  if (!POZIOMY.includes(poziom)) throw new BladDanych(`--poziom=${poziom}: dozwolone ${POZIOMY.join(", ")}`);
  const zrodla = ["baza", "pliki", "stdin"].filter((f) => flagi.has(f));
  if (zrodla.length !== 1) throw new BladDanych("podaj DOKŁADNIE jedno źródło listy plików: --baza=<ref> | --pliki=a,b | --stdin");
  const bezSmoke = flagi.has("bez-smoke");
  const sucho = flagi.has("sucho");

  const u = wczytajKonfiguracje({ cwd, plikKonfigu: tekstFlagi(flagi, "config", "") || undefined });

  let surowe;
  if (flagi.has("baza")) {
    const ref = tekstFlagi(flagi, "baza", "");
    if (!ref) throw new BladDanych("--baza= jest puste");
    const r = spawnSync("git", ["diff", "--name-only", "--no-renames", ref], { cwd, encoding: "utf8", maxBuffer: 256 * 1024 * 1024 });
    if (r.error || r.status !== 0) throw new BladDanych(`git diff --name-only ${ref} nie powiodło się: ${(r.stderr || r.error?.message || "").trim()}`);
    surowe = r.stdout.split(/\r?\n/);
  } else if (flagi.has("pliki")) {
    surowe = tekstFlagi(flagi, "pliki", "").split(",");
  } else {
    surowe = readFileSync(0, "utf8").split(/\r?\n/);
  }
  const zmienione = normalizujWejscie(surowe);
  if (!zmienione.length) throw new BladDanych("pusta lista zmienionych plików: nie wiem, co testować (nic nie zgaduję)");

  const pliki = listaPlikow(cwd);
  const kodu = pliki.filter((p) => czyKodu(p, u));
  const testy = kodu.filter((p) => czyTestowy(p, u));
  if (!testy.length) throw new BladDanych("zero plików testów jednostkowych (testy.wzorzec_testu) w katalogach kodu: nie ma czego wskazać");

  if (sucho) {
    return {
      kod: KOD.ZIELONE,
      wynik: {
        sucho: true,
        poziom,
        zmienione,
        testyJednostkowe: testy.length,
        sciezkiKonfiguracji: u.sciezki.map((s) => s.id),
        nic: "tryb --sucho: wejście i konfiguracja wczytane, analiza pominięta"
      },
      niesprawdzone: ["tryb --sucho: analiza grafu i komend pominięta"]
    };
  }

  const niesprawdzone = [];
  const wszystkieSciezki = u.sciezki.map((s) => ({ s, pasuje: kompilujGloby(s.pliki), pasujeTesty: kompilujGloby(s.pliki_testowe) }));
  const przegladarkowe = zmienione
    .filter((z) => u.katalogiE2E.some((k) => z.startsWith(k)) && u.wzorzecSpecu.test(z))
    .map((plik) => ({ plik, powod: "zmieniony spec przeglądarkowy" }));

  const graf = zbudujGraf(czytajPliki(cwd, kodu), u.alias);
  const odwrotny = odwrocGraf(graf);

  // (1) testy jednostkowe per zmieniony plik kodu
  const perPlik = new Map();
  const jednostkowe = new Map();
  const dodaj = (plik, powod) => {
    if (!jednostkowe.has(plik)) jednostkowe.set(plik, powod);
  };
  const zmienioneKodu = zmienione.filter((z) => czyKodu(z, u));
  for (const z of zmienioneKodu) {
    const znalezione = new Set();
    if (czyTestowy(z, u)) {
      if (testy.includes(z)) {
        znalezione.add(z);
        dodaj(z, "zmieniony test");
      }
      perPlik.set(z, znalezione);
      continue;
    }
    for (const s of sasiedziTestow(z, testy)) {
      znalezione.add(s);
      dodaj(s, `sąsiad ${z}`);
    }
    const importujace =
      poziom === "task"
        ? [...(odwrotny.get(z) ?? [])]
        : [...domkniecie([z], odwrotny)].filter((p) => p !== z);
    const tryb = poziom === "task" ? "importuje" : "importuje przechodnio";
    for (const p of importujace) {
      if (!testy.includes(p)) continue;
      znalezione.add(p);
      dodaj(p, `${tryb} ${z}`);
    }
    perPlik.set(z, znalezione);
  }

  // (2) ścieżki krytyczne dotknięte zmianą; plik bez ścieżki = nieprzypisany (widoczny, nie „bez ryzyka”)
  const dotkniete = new Map();
  for (const { s, pasuje } of wszystkieSciezki) {
    const trafione = zmienione.filter(pasuje);
    if (trafione.length) dotkniete.set(s.id, { s, zrodlo: `zmiana: ${trafione[0]}` });
  }
  const nieprzypisane = zmienioneKodu.filter((z) => !czyTestowy(z, u) && !wszystkieSciezki.some((x) => x.pasuje(z)));
  if (nieprzypisane.length) {
    niesprawdzone.push(
      `${nieprzypisane.length} plików kodu bez ścieżki krytycznej (luka mapy, nie „bez ryzyka”): ${nieprzypisane.slice(0, 5).join(", ")}${nieprzypisane.length > 5 ? " …" : ""}`
    );
  }

  // (3) smoke: ścieżki z testy.smoke dokładane na poziomie fala (chyba że --bez-smoke)
  const smokeWlaczony = poziom === "fala" && !bezSmoke;
  if (smokeWlaczony) {
    for (const id of u.smoke) {
      const wpis = wszystkieSciezki.find((x) => x.s.id === id);
      if (!wpis) {
        niesprawdzone.push(`smoke: ścieżka „${id}” nie istnieje w konfiguracji`);
        continue;
      }
      if (!dotkniete.has(id)) dotkniete.set(id, { s: wpis.s, zrodlo: "smoke (dokładana niezależnie od zmian)" });
    }
  }

  // (4) pliki testowe ścieżek dotkniętych zmianą + komendy
  for (const { s, pasujeTesty } of wszystkieSciezki) {
    if (!dotkniete.has(s.id)) continue;
    for (const t of testy.filter(pasujeTesty)) dodaj(t, `pliki testowe ścieżki ${s.id}`);
  }
  let listaJednostkowych = [...jednostkowe.keys()].sort();
  if (poziom === "wydanie") {
    listaJednostkowych = [...testy].sort();
    for (const t of listaJednostkowych) if (!jednostkowe.has(t)) jednostkowe.set(t, "wydanie: pełny zestaw");
  }

  const komendy = [];
  for (const [id, { s }] of dotkniete) {
    for (const cmd of s.testy) komendy.push({ etap: "sciezka", sciezka: id, komenda: cmd });
  }
  if (listaJednostkowych.length) {
    komendy.push({
      etap: "jednostkowe",
      komenda: u.komendaJednostkowych.replace("{pliki}", listaJednostkowych.map(cytuj).join(" "))
    });
  } else if (!przegladarkowe.length && zmienione.some((z) => czyKodu(z, u))) {
    niesprawdzone.push("brak testów jednostkowych wskazanych dla zmian kodu (ani sąsiadów, ani importujących)");
  }
  if (przegladarkowe.length) {
    niesprawdzone.push(`zmieniony spec przeglądarkowy (${przegladarkowe.map((p) => p.plik).join(", ")}): uruchom ręcznie, komendy wg ścieżek`);
  }
  if (smokeWlaczony && u.smoke.length === 0) {
    niesprawdzone.push("smoke: testy.smoke pusty w konfiguracji, nic nie dołożono");
  }

  // (5) naruszenie: zmieniony plik ścieżki krytycznej bez żadnego testu (obok, w grafie, ani pliki testowe ścieżki)
  const krytyczne = new Set(u.sciezki.filter((s) => u.krytyczne.includes(String(s.kategoria).toLowerCase())).map((s) => s.id));
  const naruszenia = [];
  for (const z of zmienioneKodu) {
    if (czyTestowy(z, u)) continue;
    const idy = wszystkieSciezki.filter((x) => x.pasuje(z)).map((x) => x.s.id);
    if (!idy.some((id) => krytyczne.has(id))) continue;
    // strict: liczy się test obok pliku albo test, którego graf importów sięga pliku; sama obecność
    // testów w katalogu ścieżki (pliki_testowe) NIE wystarcza, bo tak plik zostałby „pokryty” bez dowodu
    const maTest = (perPlik.get(z)?.size ?? 0) > 0;
    if (!maTest) naruszenia.push({ plik: z, sciezki: idy, powod: "plik ścieżki krytycznej bez testu jednostkowego obok ani w grafie importów" });
  }

  const tylkoNieKod = zmienione.every((z) => !czyKodu(z, u)) && !przegladarkowe.length;
  const wynik = {
    poziom,
    zmienione,
    tylkoNieKod,
    sciezki: [...dotkniete.values()].map(({ s, zrodlo }) => ({ id: s.id, nazwa: s.nazwa, kategoria: s.kategoria, zrodlo })),
    jednostkowe: listaJednostkowych.map((plik) => ({ plik, powod: jednostkowe.get(plik) })),
    przegladarkowe,
    komendy,
    nieprzypisane,
    naruszenia,
    smoke: { wlaczony: smokeWlaczony, sciezki: smokeWlaczony ? u.smoke : [] }
  };
  if (tylkoNieKod) {
    niesprawdzone.push("zmiany bez kodu produktu w katalogach kodu: testy jednostkowe tylko z plików testowych dotkniętych ścieżek (jawnie, nie cisza)");
  }
  return { kod: naruszenia.length ? KOD.NARUSZENIE : KOD.ZIELONE, wynik, niesprawdzone };
}

if (jestUruchomionyBezposrednio(import.meta.url)) {
  process.exitCode = wykonajCli("mapa-testow", uruchomMape);
}
