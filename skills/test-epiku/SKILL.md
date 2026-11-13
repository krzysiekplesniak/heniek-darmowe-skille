---
name: test-epiku
description: "Use when a wave or epic is coded and its code review is closed, and its tests must now be written and run before verify and the single PR: 'przetestuj epik', 'przetestuj falę', 'testy po CR', 'T2'. Input is the CR result (findings, test gaps). Użyj po kodzie i po CR, gdy trzeba napisać i uruchomić testy nowego kodu oraz miejsc, w których CR znalazł błąd. NOT code review (zakres-cr), NOT tests of old code (fala-pokrycia-testow, jeśli masz ten skill), NOT one named UI defect (petla-naprawa-przeklik, jeśli masz ten skill), NOT a release audit."
---

# test-epiku: testy fali po CR, napisane, uruchomione, zmierzone

Testy idą PO CR, nigdy równolegle z nim. Skill nie robi CR.

```
kod (quick-fix-qa-plus) -> CR z poprawkami (zakres-cr) -> TESTY (ten skill) -> verify -> JEDEN PR
```

Poziomy: T0 commit, T1 verify, **T2 = ten skill**, T3 pełne testy (staging, noc, przycisk) poza skillem.

**Zasada:** skrypt orkiestruje, model ocenia i pisze. Zakres, pomiar, detekcję, lint, metki i bramkę liczą skrypty z `scripts/`. Niczego nie liczysz z pamięci.

## Wejście i droga (etap A)

- Zakres: `baza` i `glowa` (refy git). Brak zakresu: od ostatniego SHA fali.
- Wejście z CR: tabela fali (znaleziska, stany, SHA poprawek) i lista luk. Bramka zamknięcia CR (klucz `bramka_cr`) ma kod 0.
- Pełna droga bez wyniku CR: STOP, najpierw `zakres-cr`. Wyjątek: właściciel jawnie pominął CR; w raporcie `CR: NIESPRAWDZONE (pominięty decyzją)`.

| Droga | Kiedy | Co |
|---|---|---|
| **Mała (Light)** | 1 do 4 zadań, poza ścieżkami pieniędzy, tożsamości i dostępu | A, B, C robi ORK; D jeden agent; E bez osobnego weryfikatora; G i H skryptami |
| **Pełna (Epik)** | od 5 zadań albo zmiana na ścieżce pieniędzy, tożsamości lub dostępu | cała rura A-H, agenci po ścieżkach, osobny weryfikator (etap E) |

Wątpliwość = pełna. Wybór zapisz w pierwszym wierszu raportu. Miejsce pracy: okno ORK (`references/tryb-lokalny.md`) albo runner (`references/tryb-vps.md`). Rdzeń jest ten sam.

## Konfiguracja (fail-closed)

Skrypty czytają `.claude/projekt-heniek.json` (`--config=<plik>` nadpisuje): obiekt `testy` i tablicę `sciezki`. Klucze: `references/wymagane-skrypty.md`.

- Brak pliku, obiektu `testy`, mapy ścieżek albo komend warstw = STOP z raportem: co brakuje i co przez to jest NIESPRAWDZONE.
- Kod 2 = nic nie policzono. Nigdy zero luk, nigdy zielone.
- Kod 0 z niepustym polem `niesprawdzone` = wynik częściowy, nie PASS.

## Kroki A-H

| Etap | Kto | Co robi | Koniec etapu = |
|---|---|---|---|
| **A. Przyjęcie** | ORK | Zakres i wejście z CR. Light: CR nie dotyczy, zapisz to jawnie | zakres i wejście zapisane |
| **B. Pomiar PRZED** | ORK, skrypty | Mapa testów zakresu; pokrycie do pliku; wskazane testy: ok / czerwone / pominięte | liczby PRZED w pliku |
| **C. Plan luk** | ORK | Wiersz = jedna luka z trzech źródeł: (1) nowy kod bez testu zachowania, (2) luki i POPRAWKA z CR, (3) szersze pokrycie wokół błędu. Poprawiacz z CR zostawia tylko jednorazową czerwień i kontrolę negatywną, więc trwały test regresji każdej poprawki piszesz tutaj | tabela luk: warstwa, ścieżka, plik docelowy |
| **D. Agenci** | agenci, jawny `model` | 1 agent = 1 ścieżka klienta; tworzy tylko nowe pliki testów z koperty; autor testu inny niż autor kodu luki; nie commituje; do 3 piszących naraz | raporty; `git status` pokazuje tylko nowe pliki testów |
| **E. Weryfikacja** | skrypty, agent (Epik) | Detektor, lint, dwie kontrole negatywne każdego nowego testu (na kopii). Epik: osobny agent ocenia, czy test woła prawdziwy kod | wyniki skryptów 0/1/2 i ocena |
| **F. Rejestry, metki, commit** | ORK, skrypt | Rejestry testów edytuje ORK. Metki scenariuszy sprawdza `walidator-metek.mjs`. Commit z numerami luk w treści | czysta gałąź, SHA |
| **G. Uruchomienie** | ORK, skrypty | Dopiero po zakończeniu WSZYSTKICH piszących agentów. Warstwy w kolejności (`references/warstwy-i-metki.md`). Każdy nowy test 3x solo. Warunek: uruchomionych > 0 | wynik per warstwa z kodem wyjścia |
| **H. Pomiar PO, bramka, raport** | ORK, skrypt | Pokrycie PO, porównanie z PRZED, zapadka (zasada 6), bramka testów, zlecenie warstwy 2 przekliku | tabela + lista pytań |

Komendy (`<skill>` = katalog tego skilla; `<baza>`, `<glowa>` = refy git; `<scratch>` = katalog tymczasowy sesji; ścieżki pełne):

```
# B: zakres z listy git baza...glowa (nie z drzewa roboczego)
git diff --name-only --no-renames <baza>...<glowa> | node <skill>/scripts/mapa-testow.mjs --stdin --poziom=fala
# B i H: pomiar pokrycia (JSON na stdout; markdown tylko do jawnej ścieżki)
node <skill>/scripts/pokrycie-testow.mjs --zapisz=<scratch>/pokrycie-przed.md > <scratch>/pokrycie-przed.json
# E: edycja i osłabianie istniejących testów
node <skill>/scripts/detektor-testow.mjs --baza=<baza> --glowa=<glowa> [--wyjatki=<plik>]
# E: nowe pliki .feature
node <skill>/scripts/lint-scenariuszy.mjs --baza=<baza> --glowa=<glowa>
# F: zmiany metek stanu względem bazy
node <skill>/scripts/walidator-metek.mjs --baza=<baza> --glowa=<glowa> [--dowod-testu=<sha-lub-plik>]
# H: bramka zamknięcia testów fali
node <skill>/scripts/bramka-testow-fali.mjs --plan=<scratch>/plan.json [--config=<plik>] [--repo=<katalog>]
```

Kody (flagi i pułapki: `references/wymagane-skrypty.md`):
- `mapa-testow`: 1 = ścieżka krytyczna bez testu; 2 = zero testów. Dla zakresu gałęzi `--stdin` (nie `--baza`).
- `pokrycie-testow`: 1 = ścieżka krytyczna bez testu; 2 = zła konfiguracja.
- `detektor-testow`: 1 = trafienia; 2 = zły ref. Nie widzi braku testów w zakresie: sprawdź `pliki_testowe`.
- `lint-scenariuszy`: 1 = naruszenie; 2 = brak pomiaru, także zero plików `.feature`.
- `walidator-metek`: 1 = naruszenie; 4 = STOP na decyzję właściciela; 2 = brak pomiaru. Priorytet 1 > 4 > 2 > 0.
- `bramka-testow-fali`: tylko plik planu, który pisze ORK (nie uruchamia detektora ani lintu, nie sprawdza prawdziwości przebiegów).

## Warstwy i metki

Które warstwy pisze ten skill, gdzie biegną i jak działa metka `@planowane` -> `@na-galezi`: `references/warstwy-i-metki.md`. Skrót: scenariusz przed kodem ma metkę `@planowane`; ORK zmienia ją na `@na-galezi` dopiero po zielonym G (3x solo) i z dowodem. `@jest` nadaje proces wydania, nie ten skill.

## Zasady twarde

1. **Zakres z mapy, nie z pamięci.** Plik wspólny nie mapuje się sam na zależne ścieżki: smoke dołączasz, gdy zmiana dotyka pliku wspólnego, pieniędzy, tożsamości, zgody lub cookies.
2. **Czerwony to hipoteza.** Uruchom solo 3 razy i nazwij klasę: (a) defekt produktu, (b) test lub niestabilność, (c) środowisko. Nigdy „regresja” z samej lektury logu. Klasa (a) to znalezisko w rejestrze CR, nie poprawka w tym skillu. Nie osłabiaj asercji.
3. **Każdy nowy test: DWIE kontrole negatywne** (mutacja kodu na kopii; zepsute oczekiwanie) i **3x solo zielony**. Test, który nie czerwienieje, to deklaracja. Procedura: skill `quick-fix-qa-plus` (wołaj, nie kopiuj).
4. **Test woła prawdziwy kod** tą samą ścieżką co produkcja. Regex po źródle, przypinanie nazw i kopia funkcji nie są testem zachowania.
5. **Zero testów = NIESPRAWDZONE, nie PASS.** Każdy przebieg ma w dowodzie kod wyjścia i liczbę uruchomionych > 0.
6. **Zapadka.** Liczba plików bez testu w zakresie nie rośnie, pokrycie dotkniętych ścieżek nie spada, względem PRZED (liczby z `pokrycie-testow`, progi w `testy.zapadka`). 100% tylko na ścieżkach pieniędzy, tożsamości i dostępu. Pokrycie to osiągalność, nie dowód zachowania.
7. **Jeden przebieg naraz na wspólnej bazie lub stagingu.** Blokada: katalog-semafor w katalogu tymczasowym, sprawdzany przed startem.
8. **Agenci nie commitują.** Commit robi ORK (albo runner). Sekrety: nie czytasz plików z sekretami; wartości nie trafiają do czatu ani logu.
9. **Autor testu inny niż autor kodu luki.** Agent testów dostaje kryteria, scenariusze i listę luk; kod czyta tylko po to, by podpiąć test.
10. **Istniejących testów nie edytujesz ani nie osłabiasz.** Agent tworzy tylko nowe pliki. Detektor wykrywa osłabienia (usunięte lub zmienione asercje, `skip`/`fixme`/`only`/`todo`). Trafienie bez wpisu w `--wyjatki` to `EDYCJA TESTU`. Bez zgody właściciela zakaz „healera” i obcych skilli.

## Tryb lekki dla jednej zmiany

Dotyczy zmiany w 1 pliku (drodze Light, poza pieniędzmi, tożsamością i dostępem). Gdy brakuje `.claude/projekt-heniek.json`, mapy ścieżek, rejestrów albo `docs/`, nie kończysz na STOP z kodem 2:

1. **Fallback bez konfiguracji:** zakres z `git diff --name-only`, komenda testów z profilu (`komenda_testow`) albo `package.json`; pomiar PRZED/PO to uruchomienie wskazanych testów (liczba uruchomionych, kod wyjścia). Skrypty `mapa-testow`, `pokrycie-testow`, `bramka-testow-fali` pomijasz.
2. **Jawne oznaczenie:** w raporcie linia `NIESPRAWDZONE: pokrycie, zapadka, bramka testów fali, rejestry (tryb lekki, brak konfiguracji)`. Warstwa bez przebiegu nadal jest NIESPRAWDZONE, nie PASS.
3. **Wynik:** kod wyjścia i opis (0 = uruchomione > 0 i zielone; 1 = czerwone; 2 = nic nie uruchomiono, z opisem braków i następnym krokiem), nie samo STOP.

**Kto robi kontrole negatywne w Light:** nie autor kodu testu. Robi je osobny agent (inny niż ten, który napisał test) albo koordynator (ORK), na kopii pliku i bez `git stash` (opis w skillu `quick-fix-qa-plus`, sekcja o kontroli negatywnej). Autor testu nie ocenia własnego testu.

**„3x solo zielony" jest wymagane tylko w trybie Epik.** W Light wystarczy jedno uruchomienie solo zielone po obu kontrolach negatywnych; powtarzalność 3x dołożysz, gdy test dotyka czasu, sieci lub kolejności. Dwie kontrole negatywne obowiązują w obu trybach.

**Komenda testów:** z profilu (`komenda_testow`) albo `package.json`, nie goły `node --test`. Przykład (nie zaszyty w skillu): `node --experimental-strip-types --import <rejestr-transpilera> --test <pliki>`, gdzie rejestr transpilera to plik projektu z `package.json`.

**Git Bash na Windows:** `python3` bywa atrapą i wiesza polecenie; używaj `node`.

## Limit rund napraw

**1 runda pisania i uruchomienia + 1 runda napraw** (czerwone klasy b i c, uwagi weryfikatora). Trzecia runda nigdy z automatu: pytanie na liście z rekomendacją (CR końcowe linii po przekliku to osobna reguła skilla `zakres-cr` (limit rund i luka testowa), nie runda napraw testów). Znalezisko klasy (a) liczy się do wspólnego limitu fali. Limit „3 próby” dotyczy kodowania zadania, nie rundy testów.

## Stan luki

Każda luka kończy w dokładnie jednym stanie: `POKRYTE` (plik testu, SHA), `ISTNIEJE` (test sprzed poprawki, który już ją pokrywa, SHA), `ODLOZONE Qn` (powód; Qn na liście pytań), `NIE DOTYCZY` (powód). `OCZEKIWANA CZERWIEN` nie przechodzi zamknięcia. Warstwa bez przebiegu to NIESPRAWDZONE, nigdy PASS. Luka wymagająca zmiany kodu produktu albo wymiany słabego testu to znalezisko w rejestrze CR (POPRAWKA albo POPRAWKA TESTU).

## Wyjście: tabela i pytania

Tabela, zawsze te same kolumny:

| Warstwa | Napisane | Uruchomione | Zielone | Czerwone (klasa) | Pominięte (powód) | Stan |
|---|---|---|---|---|---|---|

Pod nią: pomiar PRZED -> PO; luki w stanie końcowym; dowody (komenda, kod wyjścia, liczba uruchomionych, wynik bramki i walidatora); co jest NIESPRAWDZONE i dlaczego; pliki bez testu poza zakresem (do `fala-pokrycia-testow`, jeśli masz ten skill); miara tripletu (uwagi CR, błędy po CR wykryte testami, błędy po PR: `NIEZNANE` do czasu danych).

**Stan warstwy:** `PASS` tylko gdy uruchomione > 0, czerwonych 0 i kod wyjścia 0. Inaczej `CZERWONE` albo `NIESPRAWDZONE`.

**Pytania:** jedna lista, numerowana, każde z rekomendacją, w tej samej wiadomości co tabela. Pytasz tylko o to, co zmienia pieniądze, zgodę lub prawo, strategię, tekst dla klienta, usuwanie danych, odłożone luki i warstwy niesprawdzone. Resztę rozstrzygasz sam i zapisujesz.

## Red flags: zatrzymaj się

- Brak wyniku CR, mapy, pomiaru lub bramki: STOP z raportem, nie liczysz „na oko”.
- Testy plików spoza epiku i CR (to `fala-pokrycia-testow`, jeśli masz ten skill): nie pisz.
- Test poprawiony tak, żeby zzieleniał: `EDYCJA TESTU`, nie naprawa.

## Referencje

- `references/tryb-lokalny.md`: okno ORK, koperta, bariera pisania i uruchamiania, kanał pytań.
- `references/tryb-vps.md`: job runnera, budżet, brak przeglądarki właściciela.
- `references/wymagane-skrypty.md`: klucze konfiguracji, flagi i kody skryptów, format planu bramki, czego bramka nie sprawdza.
- `references/kontrola-negatywna.md`: dwie kontrole na każdy nowy test (mutacja kodu, zepsute oczekiwanie), testy udające bramkę, zapis w raporcie.
- `references/warstwy-i-metki.md`: tabela warstw, metki `@planowane` / `@na-galezi`, reguły walidatora.
- Skille: `zakres-cr` (CR, wejście), `quick-fix-qa-plus` (kontrola negatywna, dowód), `przekliki-ogorkowe` (scenariusze); jeśli masz te skille: `przeklik-mieszany` (warstwy 1 i 2), `fala-pokrycia-testow` (stary kod), `petla-naprawa-przeklik` (jeden defekt UI), `paczka-joba` (koperta).

## PROTOKOL-POSTEPU (agenci)

Każdy brief agenta zlecany z tego skilla kończy się blokiem „PLAN I POSTĘP” z pliku `protokol-postepu.md` (katalog references skilla `rdzen-ork`, jeśli masz ten skill; bez niego trzymaj ten sam schemat pól: `nazwa`, `etap`, `brief`, `kroki`, `krok`, `eta_min`, `teraz`) (etap w pliku postępu: Testy|E2E). Nazwa w pliku = opis agenta; ostatni zapis `krok = liczba kroków + 1`. Brief bez bloku jest niepełny: dopisz go przed wysłaniem. Katalog plików postępu podaje zleceniodawca (nie zgaduj ścieżki).
