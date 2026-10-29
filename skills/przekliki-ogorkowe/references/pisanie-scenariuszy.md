# Jak pisać scenariusze przeklików

## Słowa kluczowe, które rozumie parser

| po polsku | po angielsku | rola |
|---|---|---|
| `Funkcja:` (`Właściwość:`) | `Feature:` | jedna ścieżka klienta na plik |
| `Tło:` | `Background:` | kroki wspólne dla każdego scenariusza pliku (przed pierwszym scenariuszem) |
| `Scenariusz:` / `Przykład:` | `Scenario:` / `Example:` | jedna historia od wejścia do skutku |
| `Zakładając, że` / `Mając` | `Given` | stan wyjściowy |
| `Kiedy` / `Gdy` | `When` | działanie klienta |
| `Wtedy` / `Wówczas` | `Then` | to, co klient widzi |
| `Oraz` / `I` / `Ale` | `And` / `But` | kontynuacja poprzedniego kroku |
| `@metka` | `@tag` | linia samych metek nad Funkcją albo Scenariuszem |
| `#` | `#` | komentarz |

Nieobsługiwane celowo (parser rzuca błąd z numerem linii): `Szablon scenariusza` / `Scenario Outline`, `Przykłady` / `Examples`, `Reguła` / `Rule`, tabele `| a | b |`, docstringi `"""`. Każdy wiersz tabeli rozpisz na osobny scenariusz: przeklik ma pokazać, który przypadek padł, a nie "tabela czerwona".

## Struktura pliku

```gherkin
# language: pl
@rola:klient
Funkcja: <ścieżka klienta jednym zdaniem>
  Jako <kto>
  chcę <co>
  żeby <po co, w języku klienta>.

  Tło:
    Zakładając, że otwieram "/start" na telefonie

  @jest @sciezka:zakup
  Scenariusz: <wynik, który klient widzi, nie nazwa ekranu>
    Kiedy ...
    Wtedy ...
```

Nazwa scenariusza mówi o **skutku** ("Poprawne dane prowadzą na pulpit konta"), nie o mechanice ("Test formularza logowania").

## Metki

| metka | znaczenie | klikane domyślnie |
|---|---|---|
| `@jest` | funkcja istnieje na gałęzi głównej | tak |
| `@na-galezi` | funkcja istnieje tylko na gałęzi w budowie | tak |
| `@planowane` | zapis wymagania; funkcji jeszcze nie ma albo czeka na decyzję | nie (raport pokazuje "nie klikane") |
| `@sciezka:<id>` | ścieżka klienta z pliku projektu (id albo nazwa) | filtr przez `PRZEKLIKI_METKI` |
| `@rola:<kto>` | kto klika (klient, administrator, partner) | opis |

Scenariusz `@planowane` jest wartościowy: to wymaganie zapisane zdaniami klienta, które jutro stanie się testem. Zmiana metki na `@jest` następuje razem z kodem funkcji.

## Dobre zdania kroków

| dobrze | źle | dlaczego |
|---|---|---|
| `klikam "Zapłać"` | `klikam w przycisk #pay-btn` | klient nie widzi id; rola i nazwa łapią też dostępność |
| `widzę tekst "Zamówienie przyjęte"` | `strona się załadowała` | "załadowała" nie mówi, co sprawdzić |
| `wpisuję "jan@example.com" w pole "E-mail"` | `wypełniam formularz` | jeden krok = jedno działanie, parametry jawne |
| `wpisuję hasło testowe w pole "Hasło"` | `wpisuję "Tajne123!" w pole "Hasło"` | sekret nie żyje w pliku .feature; krok czyta go ze zmiennej |
| `otwieram "/koszyk" na drugim telefonie` | `odświeżam stronę` | "drugi telefon" (nowy kontekst) łapie stan trzymany tylko w pamięci karty |

Parametry zawsze w cudzysłowach `"..."`: definicja kroku łapie je grupą `"([^"]+)"`. Ten sam sens = to samo zdanie we wszystkich plikach (inaczej rośnie liczba definicji i pojawiają się niejednoznaczności).

## Czego szukać przy układaniu scenariuszy ścieżki

1. **Droga szczęśliwa** od wejścia do skutku (jeden scenariusz).
2. **Błędy klienta:** złe dane, pusty formularz, podwójny klik, powrót przyciskiem wstecz w połowie.
3. **Drugie urządzenie albo powrót po czasie:** czy stan przetrwał poza kartą przeglądarki.
4. **Wejście z boku:** link z maila, link sprzed zmiany, adres bez wymaganego parametru.
5. **Granice:** zero elementów, jeden element, bardzo długi tekst, telefon 375 px.

Każdy z tych scenariuszy kończy się krokiem `Wtedy`, który klient widzi.

## Definicja kroku (TypeScript, w `e2e/przekliki/kroki/`)

```ts
krok(/^klikam "([^"]+)"$/u, async (swiat, nazwa) => {
  const cel = swiat.page.getByRole("button", { name: nazwa }).or(swiat.page.getByRole("link", { name: nazwa })).first();
  await expect(cel).toBeVisible({ timeout: 20_000 });
  await cel.click();
});
```

- Wzorzec zakotwiczony `^...$`: zdanie pasuje do dokładnie jednej definicji (dwie = błąd "niejednoznaczny").
- Krok zostawia **dowód** (`swiat.dowod(...)`: adres, status HTTP, widoczny tekst), nigdy sekret.
- Krok, którego nie da się wykonać w tym środowisku (brak skrzynki testowej, brak hasła testowego), rzuca `new Blokada("powód")`. Nie zwraca po cichu.
- Stan między krokami jednego scenariusza: `swiat.stan`. Między scenariuszami stanu nie ma.
