# Klasy defektów UX/UI, które wracają w każdej aplikacji

Każda z tych klas wróci w kolejnym komponencie. Szukaj ich aktywnie. Po pierwszej turze dopisz w repo użytkownika własny katalog (np. `docs/ux/klasy-defektow.md`): przykłady z TEGO kodu, mapa własności plików, wykluczenia, stan pokrycia (co zaudytowane, co naprawione, co nigdy nietknięte).

| # | klasa | objaw | jak łapać |
|---|---|---|---|
| K1 | **Token-widmo** | `var(--nazwa)` z tokenem, który nie istnieje: CSS cicho ignorowany, element bez ograniczenia, żadnego błędu | wypisz wszystkie `var(--...)` z plików i porównaj z listą tokenów w plikach kanonu |
| K2 | **Znikające linie** | obramowania, separatory, tory na kolorze zbyt bliskim tłu (np. 1,3:1 przy progu 3:1) | licz kontrast pary tło/element; w OKLCH różnica jasności poniżej 0,10 to alarm |
| K3 | **Remis z-index** | dwa elementy na tej samej warstwie: wygrywa kolejność DOM, nie intencja | `git grep -n "z-"` i porównanie z tokenami warstw; podniesienie WEWNĄTRZ karty ma własny poziom, poziomy chrome aplikacji są zarezerwowane |
| K4 | **Dzikie rozmiary tekstu mimo skali** | `text-[13px]`, `font-size: 13px` obok istniejącej skali typografii | `git grep -nE "text-\[[0-9.]+px\]"`; mapuj na najbliższy stopień skali |
| K5 | **Wartość spoza tokenów mimo tokenu** | proporcje, warstwy, skala wciśnięcia, padding, kolor tła karty wpisane na sztywno, choć token istnieje | porównaj wartości z listą tokenów; komentarze w pliku tokenów często mówią, co ma migrować |
| K6 | **Cel dotyku poniżej 44 px** | mały chip, link, ikona obok poprawnych 44 px na tym samym ekranie | pomiar na żywym ekranie; naprawa: obszar 44 px na elemencie klikanym, wizualnie mniejsza pigułka w środku (nie powiększaj wyglądu) |
| K7 | **Kanon złamany, choć komponent istnieje** | ktoś przepisał klasy przycisku zamiast zaimportować komponent | ten sam wygląd w dwóch plikach, z których jeden nie importuje komponentu |
| K8 | **Fokus niewidzialny** | pierścień fokusu w kolorze elementu | `git grep -n "ring-primary"` i podobne; pierścień ma własny token |
| K9 | **Wygląd zależny od danych, nie od kontekstu** | wariant "drugorzędny" przycisku z danych, a na ekranie zostaje JEDEN przycisk, który wygląda na wyłączony | przy każdym wariancie primary/secondary pytaj: zależy od danych czy od tego, co użytkownik widzi obok? |
| K10 | **Licznik liczy inną jednostkę, niż pokazuje** | "6 z 7", bo mianownik liczy też ekran końcowy | porównaj mianownik z realną liczbą kroków, przez które przechodzi użytkownik |
| K11 | **Redesign dodał nowe, nie usunął starego** | dwa systemy informujące o tym samym na jednym ekranie | gdy komentarz mówi "X zastąpiło Y", sprawdź grepem, czy Y zniknęło; semantykę starego (np. `role="progressbar"`, na której opierają się testy) PRZENIEŚ |
| K12 | **Klikalny tylko tekst w dużym kontenerze** | kontener z paddingiem wygląda na przycisk, a `onClick` siedzi na wewnętrznym elemencie wielkości tekstu | klik w róg kontenera na żywym ekranie; uchwyt kliknięcia na całym kontenerze |
| K13 | **Flex zjada odstępy** | sąsiednie elementy tekstu sklejone ("Cena:49 zł") po zmianie na flex | zrzut po zmianie układu; `gap` zamiast spacji w tekście |
| K14 | **Szkielet ładowania niewidoczny bez animacji** | szkielet w kolorze tła; sygnał niesie tylko pulsowanie (a przy ograniczonym ruchu znika) | zrzut statyczny ekranu ładowania |
| K15 | **Test pinuje implementację** | test sprawdza KLASĘ (`w-full`, `sr-only`), a intencją było zachowanie | przepisz asercję na intencję i zostaw komentarz z datą; nie kasuj bez śladu |
| K16 | **Masowa podmiana trafia w regex** | podmiana tekstu po całym repo wstawia znaki specjalne w środek wyrażenia regularnego w testach | przed masową podmianą `git grep` frazy wewnątrz `/.../` |

## Waga (do raportu w klasach)

- Klasa 1 (realne, widoczne): K2, K6, K8, K9, K10, K12, K13, K14.
- Klasa 2 (higiena): K1, K3, K4, K5, K7, K11, K15, K16, chyba że w danym miejscu dają objaw widoczny: wtedy klasa 1.
