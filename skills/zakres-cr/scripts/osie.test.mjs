import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { globNaRegex, waliduj, przypiszOsie, wczytajKonfig, sprawdzPokrycie, sprawdzGloby, podzielNaFale, plikiRepo, RODZAJ_NIEPRZYPISANE } from "./osie.mjs";

const SKRYPT = fileURLToPath(new URL("./osie.mjs", import.meta.url));
const PRZYKLAD = fileURLToPath(new URL("../assets/projekt-heniek.przyklad.json", import.meta.url));

const KONFIG = {
  galaz_bazowa: "main",
  sciezki: [
    { id: "P1", nazwa: "Zakup", waga: 5, pliki: ["src/checkout/**", "src/lib/pay/*.ts"], testy: ["npm test -- pay"] },
    { id: "P2", nazwa: "Logowanie", waga: 4, pliki: ["src/auth/", "middleware.ts"], testy: [] },
    { id: "P3", nazwa: "Profil", waga: 2, pliki: ["src/profile/**"] },
    { id: "P4", nazwa: "Wspólne", waga: 1, pliki: ["src/shared/**", "src/checkout/wspolne.ts"] }
  ]
};

test("glob: ** przez katalogi, * w segmencie, prefiks katalogu, kropka dosłowna", () => {
  assert.ok(globNaRegex("src/checkout/**").test("src/checkout/a/b/c.tsx"));
  assert.ok(globNaRegex("src/**/x.ts").test("src/x.ts"));
  assert.ok(globNaRegex("src/lib/pay/*.ts").test("src/lib/pay/stripe.ts"));
  assert.ok(!globNaRegex("src/lib/pay/*.ts").test("src/lib/pay/sub/stripe.ts"), "* nie przechodzi przez /");
  assert.ok(globNaRegex("src/auth/").test("src/auth/session.ts"));
  assert.ok(!globNaRegex("middleware.ts").test("middlewareXts"), "kropka nie jest dowolnym znakiem");
});

test("przypiszOsie: liczba osi = liczba dotkniętych ścieżek, sortowanie po wadze, pliki poza ścieżkami osobno", () => {
  const w = przypiszOsie(["src/profile/a.tsx", "src/checkout/page.tsx", "README.md", "src/auth/x.ts"], KONFIG);
  assert.deepEqual(w.fale.map((f) => f.map((o) => o.id)), [["P1", "P2", "P3"]], "trzy ścieżki mieszczą się w jednej fali");
  assert.deepEqual(w.poza_sciezkami, ["README.md"]);
  assert.deepEqual(w.poza_rodzaje, { [RODZAJ_NIEPRZYPISANE]: ["README.md"] }, "bez reguł nie_sciezki plik poza ścieżką jest nieprzypisany");
  assert.deepEqual(w.pominiete, []);
  assert.deepEqual(w.bez_testow, ["P2", "P3"], "ścieżka bez testów to luka testowa do raportu");
});

test("przypiszOsie: ścieżka nr 4 NIE znika - ponad limit 3 idzie do drugiej fali, nie do kosza", () => {
  // plik wspólny trafia na każdą swoją ścieżkę (P1 i P4)
  const w = przypiszOsie(["src/checkout/wspolne.ts", "src/auth/a.ts", "src/profile/b.ts"], KONFIG, 3);
  assert.deepEqual(w.fale.map((f) => f.map((o) => o.id)), [["P1", "P2", "P3"], ["P4"]], "limit 3 dotyczy agentów na falę, nie liczby ścieżek");
  assert.deepEqual(w.pominiete, [], "pominiete tylko z jawnego powodu, a limit nim nie jest");
  assert.ok(w.fale.every((f) => f.length <= 3));
});

test("przypiszOsie: pusty zakres jest jawny, nie cichy", () => {
  const w = przypiszOsie([], KONFIG);
  assert.equal(w.pusty, true);
  assert.deepEqual(w.fale, []);
  assert.deepEqual(w.pominiete, []);
});

const SIEDEM = {
  sciezki: Array.from({ length: 7 }, (_, i) => ({ id: `S${i + 1}`, nazwa: `Ścieżka ${i + 1}`, waga: i < 2 ? 5 : i < 4 ? 4 : 2, pliki: [`m${i + 1}/**`], testy: [`t${i + 1}`] }))
};
const WSZYSTKIE = SIEDEM.sciezki.map((s) => `m${s.id.slice(1)}/a.ts`);

test("fale: 7 ścieżek przy limicie 3 = fale 3+3+1, każda ścieżka dokładnie raz, kolejność wg wagi (pieniądze najpierw)", () => {
  const w = przypiszOsie([...WSZYSTKIE].reverse(), SIEDEM, 3);
  assert.deepEqual(w.fale.map((f) => f.length), [3, 3, 1]);
  assert.deepEqual(w.fale.flat().map((o) => o.id).sort(), SIEDEM.sciezki.map((s) => s.id).sort(), "żadna ścieżka nie wypadła i żadna się nie zdublowała");
  assert.deepEqual(w.fale[0].map((o) => o.id), ["S1", "S2", "S3"], "pierwsza fala = najwyższe wagi");
  const wagi = w.fale.flat().map((o) => o.waga);
  assert.deepEqual(wagi, [...wagi].sort((a, b) => b - a), "wagi nie rosną między falami");
  assert.deepEqual(w.fale.flat().map((o) => o.fala), [1, 1, 1, 2, 2, 2, 3], "każda ścieżka niesie numer swojej fali");
  assert.deepEqual(sprawdzPokrycie(w), []);
});

test("fale: --max dzieli, nie wycina (max=1 -> jedna ścieżka na falę; max większy niż liczba ścieżek -> jedna fala)", () => {
  assert.equal(przypiszOsie(WSZYSTKIE, SIEDEM, 1).fale.length, 7);
  assert.equal(przypiszOsie(WSZYSTKIE, SIEDEM, 10).fale.length, 1);
  assert.deepEqual(podzielNaFale([], 3), []);
});

test("pokrycie - kontrola negatywna: ścieżka usunięta z fali (stare zachowanie), zdublowana, pominięta bez powodu i fala ponad limit są wykrywane", () => {
  const dobry = przypiszOsie(WSZYSTKIE, SIEDEM, 3);
  assert.deepEqual(sprawdzPokrycie(dobry), []);
  const klon = () => JSON.parse(JSON.stringify(dobry));

  const bezS4 = klon();
  bezS4.fale = bezS4.fale.map((f) => f.filter((o) => o.id !== "S4"));
  assert.match(sprawdzPokrycie(bezS4).join(), /S4.*ani w fali, ani wśród pominiętych/, "ścieżka nr 4 zniknęła -> błąd (tak działał stary limit)");

  const dubel = klon();
  dubel.fale[1].push({ ...dubel.fale[0][0] });
  assert.match(sprawdzPokrycie(dubel).join(), /wielokrotnie/);

  const bezPowodu = klon();
  bezPowodu.fale = bezPowodu.fale.map((f) => f.filter((o) => o.id !== "S7")).filter((f) => f.length);
  bezPowodu.pominiete = [{ id: "S7", nazwa: "x", powod: "" }];
  assert.match(sprawdzPokrycie(bezPowodu).join(), /bez powodu/);

  const zaDuza = klon();
  zaDuza.max = 2;
  assert.match(sprawdzPokrycie(zaDuza).join(), /limit na falę 2/);
});

const KONFIG_TESTY = {
  sciezki: [
    { id: "K1", nazwa: "Kasa", waga: 5, pliki: ["app/kasa/**", "lib/kasa.ts"], pliki_testowe: ["tests/kasa*.test.ts"], pliki_dawne: ["lib/stara-kasa.ts"], testy: ["node --test tests/kasa.test.ts"] },
    { id: "K2", nazwa: "Strony", waga: 2, pliki: ["app/strony/**"], pliki_testowe: ["tests/strony.test.ts"] }
  ],
  nie_sciezki: [
    { rodzaj: "testy", pliki: ["tests/**"] },
    { rodzaj: "dokumenty", pliki: ["**/*.md"] }
  ]
};

test("pominiete tylko z jawnego powodu: diff dotykający wyłącznie testów ścieżki -> pominięta z powodem, a kod ścieżki NIE jest pomijany", () => {
  const tylkoTesty = przypiszOsie(["tests/kasa.test.ts", "tests/kasa-oto.test.ts"], KONFIG_TESTY, 3);
  assert.deepEqual(tylkoTesty.fale, [], "nie ma kodu do recenzji");
  assert.deepEqual(tylkoTesty.pominiete.map((o) => o.id), ["K1"]);
  assert.match(tylkoTesty.pominiete[0].powod, /tylko plików testowych/);
  assert.deepEqual(tylkoTesty.pominiete[0].testy_zmienione, ["tests/kasa.test.ts", "tests/kasa-oto.test.ts"]);
  assert.deepEqual(sprawdzPokrycie(tylkoTesty), []);

  const kodITesty = przypiszOsie(["lib/kasa.ts", "tests/kasa.test.ts"], KONFIG_TESTY, 3);
  assert.deepEqual(kodITesty.pominiete, [], "kod + test = ścieżka do recenzji, nie pominięcie");
  assert.deepEqual(kodITesty.fale[0][0].pliki, ["lib/kasa.ts"], "test nie liczy się jako kod ścieżki");
  assert.deepEqual(kodITesty.fale[0][0].testy_zmienione, ["tests/kasa.test.ts"]);
});

test("pliki poza ścieżkami dostają rodzaj z nie_sciezki; kod bez ścieżki jest 'nieprzypisany' (nie ginie)", () => {
  const w = przypiszOsie(["lib/kasa.ts", "tests/inny.test.ts", "docs/a.md", "lib/sierota.ts"], KONFIG_TESTY, 3);
  assert.deepEqual(w.poza_rodzaje, { testy: ["tests/inny.test.ts"], dokumenty: ["docs/a.md"], [RODZAJ_NIEPRZYPISANE]: ["lib/sierota.ts"] });
  assert.deepEqual(w.poza_sciezkami.sort(), ["docs/a.md", "lib/sierota.ts", "tests/inny.test.ts"]);
});

test("pliki_dawne: usunięty z repo plik nadal przypisuje stary diff do ścieżki", () => {
  const w = przypiszOsie(["lib/stara-kasa.ts"], KONFIG_TESTY, 3);
  assert.deepEqual(w.fale[0].map((o) => o.id), ["K1"]);
});

test("duplikaty plików w wejściu nie zawyżają liczby plików ani listy plików ścieżki", () => {
  const w = przypiszOsie(["lib/kasa.ts", "lib/kasa.ts", "lib\\kasa.ts"], KONFIG_TESTY, 3);
  assert.equal(w.liczba_plikow, 1);
  assert.deepEqual(w.fale[0][0].pliki, ["lib/kasa.ts"]);
});

test("waliduj: nowe pola (pliki_testowe, pliki_dawne, kategoria, nie_sciezki) - kontrola negatywna każdego", () => {
  assert.deepEqual(waliduj(KONFIG_TESTY), []);
  const baza = (s) => ({ sciezki: [{ id: "A", nazwa: "x", pliki: ["a"], ...s }] });
  assert.match(waliduj(baza({ pliki_testowe: [] })).join(), /pliki_testowe/);
  assert.match(waliduj(baza({ pliki_dawne: [""] })).join(), /pliki_dawne/);
  assert.match(waliduj(baza({ kategoria: "" })).join(), /kategoria/);
  assert.match(waliduj({ ...baza({}), nie_sciezki: [{ rodzaj: "testy" }] }).join(), /nie_sciezki\[0\]/);
  assert.match(waliduj({ ...baza({}), nie_sciezki: "testy" }).join(), /nie_sciezki musi być tablicą/);
});

test("sprawdzGloby: wzorzec bez pliku, literówka w globie i fałszywy 'dawny' są wykrywane", () => {
  const repo = ["app/kasa/page.tsx", "lib/kasa.ts", "tests/kasa.test.ts", "tests/strony.test.ts", "app/strony/a.tsx", "docs/a.md"];
  assert.deepEqual(sprawdzGloby(KONFIG_TESTY, repo), []);
  const literowka = JSON.parse(JSON.stringify(KONFIG_TESTY));
  literowka.sciezki[0].pliki.push("app/kasaa/**");
  assert.match(sprawdzGloby(literowka, repo).join(), /K1\.pliki: wzorzec "app\/kasaa\/\*\*" nie trafia/);
  const testowy = JSON.parse(JSON.stringify(KONFIG_TESTY));
  testowy.sciezki[1].pliki_testowe = ["tests/nie-ma.test.ts"];
  assert.match(sprawdzGloby(testowy, repo).join(), /K2\.pliki_testowe/);
  const nie = JSON.parse(JSON.stringify(KONFIG_TESTY));
  nie.nie_sciezki[1].pliki = ["**/*.rst"];
  assert.match(sprawdzGloby(nie, repo).join(), /nie_sciezki\[dokumenty\]/);
  assert.match(sprawdzGloby(KONFIG_TESTY, [...repo, "lib/stara-kasa.ts"]).join(), /pliki_dawne.*istniejący plik/, "plik dawny, który wrócił, to literówka");
});

test("waliduj: wyłapuje braki i błędy (kontrola negatywna dla każdej reguły)", () => {
  assert.deepEqual(waliduj(KONFIG), []);
  assert.match(waliduj({ sciezki: [] }).join(), /niepustą tablicą/);
  assert.match(waliduj({ sciezki: [{ id: "A", nazwa: "x", pliki: ["a"] }, { id: "A", nazwa: "y", pliki: ["b"] }] }).join(), /powtórzone id/);
  assert.match(waliduj({ sciezki: [{ id: "A", nazwa: "x", pliki: [] }] }).join(), /pliki/);
  assert.match(waliduj({ sciezki: [{ id: "A", nazwa: "x", pliki: ["a"], waga: 9 }] }).join(), /waga/);
  assert.match(waliduj({ sciezki: [{ id: "A", pliki: ["a"] }] }).join(), /brak nazwy/);
  assert.match(waliduj([]).join(), /nie jest obiektem/);
});

test("plik przykładowy z assets jest poprawny (wzór dla użytkownika nie może kłamać)", () => {
  const { konfig, blad } = wczytajKonfig(PRZYKLAD);
  assert.equal(blad, undefined);
  assert.ok(konfig.sciezki.length >= 1);
});

test("CLI: brak pliku projektu = exit 2 (fail-closed), poprawny plik + prawdziwy git = tabela osi", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "osie-"));
  const env = { ...process.env };
  for (const k of ["GIT_DIR", "GIT_WORK_TREE", "GIT_INDEX_FILE"]) delete env[k];
  const git = (...a) => {
    const r = spawnSync("git", a, { cwd: tmp, encoding: "utf8", env });
    assert.equal(r.status, 0, r.stderr);
  };
  const brak = spawnSync(process.execPath, [SKRYPT], { cwd: tmp, encoding: "utf8", env });
  assert.equal(brak.status, 2);
  assert.match(brak.stderr, /BRAK POMIARU/);

  git("init", "-q", "-b", "main");
  git("config", "user.email", "t@example.com");
  git("config", "user.name", "t");
  fs.mkdirSync(path.join(tmp, ".claude"));
  fs.writeFileSync(path.join(tmp, ".claude", "projekt-heniek.json"), JSON.stringify(KONFIG));
  fs.writeFileSync(path.join(tmp, "README.md"), "x\n");
  git("add", ".");
  git("commit", "-qm", "baza");
  git("switch", "-qc", "zmiana");
  fs.mkdirSync(path.join(tmp, "src", "checkout"), { recursive: true });
  fs.writeFileSync(path.join(tmp, "src", "checkout", "page.tsx"), "export {};\n");
  git("add", ".");
  git("commit", "-qm", "zmiana");

  // --waliduj: wzorce bez pliku w repo (src/lib/pay/*.ts, src/auth/, middleware.ts, src/profile/**, src/shared/**) = exit 2 z listą
  const bezPlikow = spawnSync(process.execPath, [SKRYPT, "--waliduj"], { cwd: tmp, encoding: "utf8", env });
  assert.equal(bezPlikow.status, 2, "glob bez pliku to błąd walidacji");
  assert.match(bezPlikow.stderr, /P1\.pliki: wzorzec "src\/lib\/pay\/\*\.ts" nie trafia/);
  for (const [dir, plik] of [["src/lib/pay", "stripe.ts"], ["src/auth", "session.ts"], [".", "middleware.ts"], ["src/profile", "a.tsx"], ["src/shared", "x.ts"]]) {
    fs.mkdirSync(path.join(tmp, dir), { recursive: true });
    fs.writeFileSync(path.join(tmp, dir, plik), "export {};\n");
  }
  fs.writeFileSync(path.join(tmp, "src", "checkout", "wspolne.ts"), "export {};\n");
  git("add", ".");
  git("commit", "-qm", "wiecej sciezek");
  const waliduje = spawnSync(process.execPath, [SKRYPT, "--waliduj"], { cwd: tmp, encoding: "utf8", env });
  assert.equal(waliduje.status, 0, waliduje.stderr);
  assert.match(waliduje.stdout, /trafiają w istniejące pliki/);

  const ok =spawnSync(process.execPath, [SKRYPT, "--zakres=main...HEAD", "--json"], { cwd: tmp, encoding: "utf8", env });
  assert.equal(ok.status, 0, ok.stderr);
  const w = JSON.parse(ok.stdout);
  assert.deepEqual(w.fale.map((f) => f.map((o) => o.id)), [["P1", "P2", "P3"], ["P4"]], "cztery ścieżki przy limicie 3 = dwie fale, czwarta nie ginie");
  assert.equal(w.pominiete.length, 0);
  assert.equal(w.liczba_plikow, 7);

  const tekst = spawnSync(process.execPath, [SKRYPT, "--zakres=main...HEAD"], { cwd: tmp, encoding: "utf8", env });
  assert.equal(tekst.status, 0, tekst.stderr);
  assert.match(tekst.stdout, /\| P4 \| Wspólne \| 1 \| .* \| 2 \|/, "tabela osi ma kolumnę fali");
  assert.match(tekst.stdout, /P4 \(Wspólne\) \| zrecenzowana \(fala 2\)/, "tabela pokrycia: ścieżka nr 4 zrecenzowana w fali 2");
  assert.match(tekst.stdout, /Fala 1: P1, P2, P3/);
  assert.match(tekst.stdout, /Fala 2: P4/);

  const jedna = JSON.parse(spawnSync(process.execPath, [SKRYPT, "--zakres=main...HEAD", "--max=1", "--json"], { cwd: tmp, encoding: "utf8", env }).stdout);
  assert.equal(jedna.fale.length, 4, "--max=1: jedna ścieżka na falę, nic nie wypada");

  const zlyRef = spawnSync(process.execPath, [SKRYPT, "--zakres=nie-ma...HEAD"], { cwd: tmp, encoding: "utf8", env });
  assert.equal(zlyRef.status, 2, "git, który nie odpowiedział, to brak pomiaru, nie pusty zakres");

  const zlaFlaga = spawnSync(process.execPath, [SKRYPT, "--cos"], { cwd: tmp, encoding: "utf8", env });
  assert.equal(zlaFlaga.status, 2);
  fs.rmSync(tmp, { recursive: true, force: true });
});

// Katalog ścieżek repozytorium, w którym leży paczka (jeśli istnieje): wzorce muszą trafiać w istniejące pliki, a diff z listy plików musi dać pełne pokrycie.
// Poza repozytorium (paczka zainstalowana u użytkownika) test jest pomijany.
const KORZEN_REPO = fileURLToPath(new URL("../../../../../", import.meta.url));
const KATALOG_REPO = path.join(KORZEN_REPO, ".claude", "projekt-heniek.json");
test("katalog ścieżek repo: poprawny, globy trafiają w istniejące pliki, fale nie gubią ścieżek", { skip: !fs.existsSync(KATALOG_REPO) || !fs.existsSync(path.join(KORZEN_REPO, ".git")) }, () => {
  const { konfig, blad } = wczytajKonfig(KATALOG_REPO);
  assert.equal(blad, undefined);
  const r = plikiRepo(KORZEN_REPO);
  assert.equal(r.blad, undefined);
  assert.deepEqual(sprawdzGloby(konfig, r.pliki), [], "katalog nie może kłamać: wzorzec bez pliku = ścieżka, której nikt nie recenzuje");
  const w = przypiszOsie(r.pliki, konfig, 3);
  assert.deepEqual(sprawdzPokrycie(w), []);
  assert.equal(w.fale.flat().length, konfig.sciezki.length, "plik z każdej ścieżki -> każda ścieżka ma swoją falę");
  assert.ok(w.fale.length >= 2, "przy limicie 3 katalog z więcej niż 3 ścieżkami daje co najmniej dwie fale");
});
