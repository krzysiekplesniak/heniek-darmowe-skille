# Uruchamianie przeklików i czytanie wyniku

## Kolejność

1. **Kontrola scenariuszy bez przeglądarki** (parser z paczki albo jego kopia w `e2e/przekliki/_silnik/`):
   `node e2e/przekliki/_silnik/gherkin.mjs e2e/przekliki` -> lista scenariuszy KLIKANY / pominięty i liczby. Exit 1 = popraw plik (numer linii w komunikacie), zanim uruchomisz przeglądarkę.
2. **Środowisko:** lokalny serwer już działa (build produkcyjny jest bliższy prawdy niż tryb deweloperski) albo `PRZEKLIKI_BASE_URL` wskazuje staging. Silnik sam serwera nie stawia.
3. **Przeklik:** `npx playwright test --config e2e/przekliki/playwright.przekliki.config.ts`.
4. **Raport:** `e2e/przekliki/raport/html/index.html` (kroki, zrzuty i ślad przy błędzie) oraz `e2e/przekliki/raport/wyniki.json` (do tabeli w raporcie).

## Zmienne

| zmienna | domyślnie | co |
|---|---|---|
| `PRZEKLIKI_BASE_URL` | `srodowiska.staging`, potem `srodowiska.lokalne` z pliku projektu, potem `http://localhost:3000` | adres aplikacji |
| `PRZEKLIKI_METKI` | `@jest,@na-galezi` | które scenariusze klikać (np. `@sciezka:zakup`) |
| `PRZEKLIKI_SCISLE` | puste | `1` = brak kroku jest czerwony także lokalnie (w CI zawsze) |
| `PRZEKLIKI_ZAKAZANE_HOSTY` | puste | dodatkowe hosty produkcji, po przecinku |
| `PRZEKLIKI_HASLO_TESTOWE` | puste | hasło konta testowego dla kroku "wpisuję hasło testowe"; brak = Blokada, nie zielony |
| `PRZEKLIKI_JEZYK` | `pl-PL` | locale przeglądarki |

Sekrety tylko ze zmiennych środowiska ustawionych przez użytkownika. Nie wpisujesz ich do plików `.feature`, dowodów ani adresów.

## Wyniki i co znaczą

| wynik w raporcie | znaczenie | co robisz |
|---|---|---|
| passed | wszystkie kroki przeszły, zero naruszeń | dowód do raportu |
| failed: "Kroki, które nie przeszły (N/M)" | lista wszystkich potknięć scenariusza | klasyfikacja a/b/c (niżej) |
| fixme: "BRAK KROKU" | zdanie bez definicji | dopisz definicję (prawdziwą) albo popraw zdanie na istniejące |
| failed: "KROK NIEJEDNOZNACZNY" | zdanie pasuje do dwóch definicji | zawęź jeden ze wzorców |
| skipped: "pominięte (blokada)" | kroku nie da się wykonać tutaj | powód do raportu; nie liczysz jako zielony |
| skipped: "nie klikane" | scenariusz bez metki klikanej (np. `@planowane`) | nic; to zapis wymagania |
| failed: "PRÓBA WYJŚCIA NA PRODUKCJĘ" | aplikacja na stagingu woła produkcję | znalezisko konfiguracji środowiska |

## Czerwony = hipoteza, nie wyrok

1. Uruchom sam ten scenariusz 3 razy: `npx playwright test --config ... -g "<nazwa scenariusza>"`.
2. Przypisz klasę:
   - **a) produkt:** pada za każdym razem, ślad pokazuje błędne zachowanie aplikacji -> defekt; naprawa z testem, który czerwieni stary kod.
   - **b) test:** zły krok, za wąski selektor, krok zależy od kolejności scenariuszy -> popraw krok, nie asercję.
   - **c) środowisko:** dane stagingu, limity, wolny serwer, wspólny staging zajęty innym przebiegiem -> zapisz i powtórz w czystym środowisku.
3. Nigdy nie osłabiasz asercji, żeby było zielono, i nie dodajesz powtórek.

Na wspólnym stagingu: **jeden przebieg naraz** (wspólne limity i liczniki dają fałszywe czerwienie, gdy dwa przebiegi się nakładają).

## Przeklik w CI

W CI ustaw `CI=1` (Playwright robi to sam na większości platform): brak kroku jest wtedy czerwony. Przeklik po stagingu uruchamiaj po wdrożeniu gałęzi, nie przy każdym commicie: jest wolny i ma sens tylko na działającej aplikacji.
