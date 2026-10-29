---
name: przekliki-ogorkowe
description: Użyj, gdy trzeba sprawdzić aplikację tak, jak klika ją człowiek - "zrób przeklik", "przeklikaj ścieżkę zakupu", "napisz scenariusz Given/When/Then", "historie użytkownika jako testy", "dopisz przeklik do tej zmiany", "czy to działa od wejścia do końca" - albo gdy testy jednostkowe są zielone, a nikt nie przeszedł ścieżki w przeglądarce. Uczy pisać scenariusze Gherkin (po polsku lub angielsku) dla ścieżek klienta i odpalać je ścisłym silnikiem Playwright: krok bez definicji NIE jest zielony, błędy zbierane do końca, produkcja zablokowana. Use when "click-through test", "gherkin", "cucumber", "BDD scenario", "user journey test", "smoke the critical path".
---

# Przekliki ogórkowe: historie klienta, które przeglądarka klika naprawdę

Przeklik to scenariusz zdaniami klienta (Gherkin: Zakładając / Kiedy / Wtedy), który silnik wykonuje w prawdziwej przeglądarce na telefonie 375 px. Łapie to, czego nie łapią testy jednostkowe: stan między ekranami, przekierowania, puste ekrany, zgubione dane po powrocie.

Zielone typy, testy jednostkowe i code review to **minimum, nie dowód**, gdy zmiana dotyka ścieżki klienta albo stanu współdzielonego między ekranami.

## Kiedy pisać przeklik

| sytuacja | przeklik? |
|---|---|
| zmiana na ścieżce klienta z wagą 4-5 (pieniądze, logowanie, dostęp) | tak, zawsze |
| zmiana stanu, który widzi kilka ekranów (koszyk, filtry, preferencje, sesja) | tak |
| poprawka widoczna tylko na jednym ekranie | wystarczy weryfikacja w przeglądarce (skill `quick-fix-qa`) |
| logika bez UI, typy, konfiguracja | nie: test jednostkowy |

Ścieżki klienta i ich wagi: `.claude/projekt-heniek.json` (wzór: `skills/zakres-cr/assets/projekt-heniek.przyklad.json`).

## Jak pisać scenariusz (skrót)

1. **Jedna Funkcja = jedna ścieżka klienta**, z opisem "Jako... chcę... żeby...". Plik `e2e/przekliki/<obszar>/NN-nazwa.feature`.
2. **Zdania klienta, nie implementacji:** "klikam »Zapłać«", nie "klikam #btn-pay". Parametry w cudzysłowach.
3. **Każdy scenariusz kończy się tym, co klient widzi** ("widzę tekst...", "adres strony zawiera..."), nie samym klikiem.
4. **Ścieżka negatywna obok pozytywnej:** złe hasło, pusty koszyk, wygasły link, powrót wstecz.
5. **Metki:** `@jest` (funkcja istnieje, klikamy), `@na-galezi` (na gałęzi w budowie), `@planowane` (zapis wymagania, nie klikane). Metka ścieżki: `@sciezka:<id>`.
6. **Bez tabel, szablonów i docstringów:** parser jest celowo ścisły; rozpisz na osobne scenariusze.

Pełne zasady, wzorce zdań i antywzorce: `references/pisanie-scenariuszy.md`. Przykład do skopiowania: `assets/przyklad/01-logowanie.feature`.

## Silnik (raz na projekt)

Skopiuj szablon do repo (wymaga `@playwright/test`):

| z paczki | do repo |
|---|---|
| `scripts/gherkin.mjs` | `e2e/przekliki/_silnik/gherkin.mjs` |
| `assets/silnik/rejestr.ts`, `assets/silnik/srodowisko.ts` | `e2e/przekliki/_silnik/` |
| `assets/silnik/przekliki.spec.ts`, `assets/silnik/playwright.przekliki.config.ts` | `e2e/przekliki/` |
| `assets/przyklad/kroki-wspolne.ts` | `e2e/przekliki/kroki/wspolne.ts` |

Trzy zasady silnika, których nie wolno osłabić:

| zasada | dlaczego |
|---|---|
| zdanie bez definicji kroku = `fixme` lokalnie, **czerwony w CI** | pominięty krok dałby zielony test, który niczego nie sprawdził |
| po błędzie kroki lecą dalej, test pada na końcu listą wszystkich potknięć | jeden przebieg pokazuje cały stan ścieżki, nie tylko pierwszą dziurę |
| krok niewykonalny w środowisku rzuca `Blokada` -> scenariusz **pominięty z powodem** | "nie dało się zmierzyć" to nie "działa" |

Bezpieczniki: adres bazowy nie może być produkcją (`srodowiska.produkcja_hosty` w pliku projektu), żądania do produkcji są przerywane i liczone jako naruszenie; zero powtórek (`retries: 0`); jeden worker.

## Jak odpalać

```bash
# 1. kontrola scenariuszy bez przeglądarki (sekundy): składnia, metki, ile klikanych
node "${CLAUDE_PLUGIN_ROOT}/skills/przekliki-ogorkowe/scripts/gherkin.mjs" e2e/przekliki
# 2. przeklik (serwer lokalny już działa albo PRZEKLIKI_BASE_URL wskazuje staging)
npx playwright test --config e2e/przekliki/playwright.przekliki.config.ts
# tylko jedna ścieżka
PRZEKLIKI_METKI=@sciezka:logowanie npx playwright test --config e2e/przekliki/playwright.przekliki.config.ts
```

Kody kontroli: 0 czysto, 1 błąd w pliku (z numerem linii), 2 brak pomiaru (brak katalogu albo zero plików). Zmienne, raport i czytanie czerwieni: `references/uruchamianie.md`.

## Czerwony przeklik to HIPOTEZA

Zanim powiesz "regresja": uruchom scenariusz sam 3 razy i przypisz klasę: **a) produkt** (defekt, do naprawy z testem), **b) test** (zły krok, niestabilny selektor), **c) środowisko** (staging, dane, limity). Nie "naprawiasz" czerwieni osłabiając asercję: czerwony przeklik bywa jedynym, kto widzi prawdziwy defekt.

## Raport

| scenariusz | metki | wynik | dowód / pierwszy błąd |
|---|---|---|---|

Plus liczby: klikane / zielone / czerwone / pominięte (blokada, z powodem) / brak kroku. Pominięty z blokadą nigdy nie jest zielony.

## Czerwone flagi

| myśl | rzeczywistość |
|---|---|
| "dopiszę definicję kroku, która nic nie robi" | to zielony test, który niczego nie sprawdził |
| "dodam retries: 2, bo czasem pada" | niestabilność to znalezisko (klasa b albo c), nie szum |
| "przeklikam na produkcji, tam są prawdziwe dane" | nigdy: bezpiecznik ma to zablokować, nie obchodzisz go |
| "selektor #id będzie pewniejszy" | klient nie widzi id; rola i widoczna nazwa łapią też dostępność |
| "scenariusz kończy się klikiem w Zapłać" | bez "Wtedy widzę..." nie ma czego sprawdzić |
