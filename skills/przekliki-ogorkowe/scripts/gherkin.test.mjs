import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { parsujFeature, przeglad, czyKlikany } from "./gherkin.mjs";

const SKRYPT = fileURLToPath(new URL("./gherkin.mjs", import.meta.url));
const PRZYKLAD = fileURLToPath(new URL("../assets/przyklad", import.meta.url));

const PL = `# language: pl
@rola:klient
Funkcja: Koszyk
  Jako klient chcę kupić

  Tło:
    Zakładając, że otwieram "/" na telefonie

  @jest
  Scenariusz: Dodanie do koszyka
    Kiedy klikam "Dodaj"
    Wtedy widzę tekst "W koszyku: 1"
    Ale nie widzę tekstu "Błąd"

  @planowane
  Przykład: Kupon
    Gdy wpisuję "RABAT" w pole "Kupon"
    Wówczas widzę tekst "-10%"
`;

test("PL: funkcja, tło, metki dziedziczone z funkcji, kroki ze słowami kluczowymi", () => {
  const f = parsujFeature(PL, "koszyk.feature");
  assert.equal(f.nazwa, "Koszyk");
  assert.deepEqual(f.opis, ["Jako klient chcę kupić"]);
  assert.equal(f.tlo.length, 1);
  assert.equal(f.tlo[0].slowo, "Zakładając, że");
  assert.equal(f.scenariusze.length, 2);
  assert.deepEqual(f.scenariusze[0].metki, ["@rola:klient", "@jest"]);
  assert.deepEqual(f.scenariusze[0].kroki.map((k) => k.slowo), ["Kiedy", "Wtedy", "Ale"]);
  assert.equal(f.scenariusze[0].kroki[1].tekst, 'widzę tekst "W koszyku: 1"');
  assert.equal(czyKlikany(f.scenariusze[0]), true);
  assert.equal(czyKlikany(f.scenariusze[1]), false, "@planowane nie jest klikane domyślnie");
});

test("EN: Feature/Background/Scenario/Given/When/Then/And/But", () => {
  const f = parsujFeature("Feature: Cart\n  Background:\n    Given I open \"/\"\n  @jest\n  Scenario: Add\n    When I click \"Add\"\n    Then I see \"1\"\n    And I see \"ok\"\n    But I do not see \"Error\"\n");
  assert.equal(f.nazwa, "Cart");
  assert.equal(f.tlo[0].slowo, "Given");
  assert.deepEqual(f.scenariusze[0].kroki.map((k) => k.slowo), ["When", "Then", "And", "But"]);
});

test("ściśle: nierozpoznana linia, tabele, szablony i scenariusz bez kroków rzucają z numerem linii", () => {
  assert.throws(() => parsujFeature("Funkcja: X\n  Scenariusz: A\n    klikam bez słowa kluczowego\n", "a.feature"), /a\.feature:3 - linia nierozpoznana/);
  assert.throws(() => parsujFeature("Funkcja: X\n  Scenariusz: A\n    Kiedy coś\n    | a | b |\n"), /nieobsługiwana/);
  assert.throws(() => parsujFeature("Funkcja: X\n  Szablon scenariusza: A\n"), /nieobsługiwana/);
  assert.throws(() => parsujFeature("Feature: X\n  Scenario Outline: A\n"), /nieobsługiwana/);
  assert.throws(() => parsujFeature("Funkcja: X\n  Scenariusz: pusty\n"), /bez kroków/);
  assert.throws(() => parsujFeature("Scenariusz: A\n  Kiedy x\n"), /przed "Funkcja:"/);
  assert.throws(() => parsujFeature("# tylko komentarz\n"), /brak "Funkcja:"/);
  assert.throws(() => parsujFeature("Funkcja: X\n  @jest coś\n  Scenariusz: A\n    Kiedy x\n"), /poza metkami/);
});

test("przykład z assets parsuje się czysto: 2 klikane, 1 planowany", () => {
  const w = przeglad(PRZYKLAD);
  assert.equal(w.kod, 0, w.bledy?.join("\n"));
  assert.equal(w.klikane, 2);
  assert.equal(w.pominiete, 1);
});

test("CLI: brak katalogu albo zero plików = 2, błąd w pliku = 1, czysto = 0", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "gherkin-"));
  const uruchom = (...a) => spawnSync(process.execPath, [SKRYPT, ...a], { encoding: "utf8" });
  assert.equal(uruchom(path.join(tmp, "nie-ma")).status, 2);
  assert.equal(uruchom(tmp).status, 2, "zero plików .feature to brak pomiaru, nie zielono");
  fs.writeFileSync(path.join(tmp, "a.feature"), PL);
  const ok = uruchom(tmp);
  assert.equal(ok.status, 0, ok.stderr);
  assert.match(ok.stdout, /klikanych: 1, pominiętych: 1, błędów: 0/);
  fs.writeFileSync(path.join(tmp, "b.feature"), "Funkcja: B\n  Scenariusz: zły\n    klikam coś\n");
  const zly = uruchom(tmp, "--json");
  assert.equal(zly.status, 1);
  assert.equal(JSON.parse(zly.stdout).bledy.length, 1);
  assert.equal(uruchom(tmp, "--metki=@planowane").status, 1, "metki nie maskują błędu parsowania");
  fs.rmSync(tmp, { recursive: true, force: true });
});
