---
name: test-epiku
description: Użyj, gdy użytkownik mówi "przetestuj epik", "przetestuj falę", "dopisz testy do tej zmiany", "testy do zadań", albo po zakodowaniu fali zadań (kilka-kilkanaście zadań jednego epiku), która potrzebuje testów, jednego celowanego przebiegu po stagingu i code review osi fali. Codzienna, MAŁA runda (ok. 15-20 minut testów): zakres z mapy zmian, stan przed, luki, nowe testy z dwiema kontrolami negatywnymi, jeden przebieg po stagingu, zapadka jakości, raport na jedną stronę. NIE do pełnego przebiegu przed wydaniem i NIE do nadrabiania pokrycia starego kodu. Use when "test this epic", "test the wave", "add tests for these changes", "targeted regression run".
---

# Test epiku: dzienna, mała, celowana runda testów fali

Runda jest **codzienna i celowana**: testy wybrane z mapy zmian, nie pełna suita. Poziomy: T0 commit (szybkie kontrole), T1 PR (jednostkowe, typy, build), **T2 fala = ten skill**, T3 wydanie (pełny przebieg, osobna runda, nie ten skill).

Komendy testów, ścieżki klienta, ich testy i adres stagingu: `.claude/projekt-heniek.json` (wzór: `skills/zakres-cr/assets/projekt-heniek.przyklad.json`). Brak pliku: pierwszym krokiem jest jego założenie z użytkownikiem, bo bez ścieżek nie ma mapy zmian.

**Wejście:** epik albo fala (nazwa), baza git (`<baza>`) albo lista plików. Bez zakresu: `origin/<galaz_bazowa>...HEAD`.

## Kroki (kolejność twarda)

1. **Zakres testów z mapy, nie z pamięci.**
   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/skills/zakres-cr/scripts/osie.mjs" --zakres=<baza>...HEAD --max=10
   ```
   Wynik: dotknięte ścieżki klienta, ich pliki i **testy osi**. Pliki kodu "poza ścieżkami": dopisz je do ścieżki w pliku projektu albo zapisz jawny powód. Ścieżki z `bez_testow` to luki do kroku 3. Dla dotkniętych ścieżek wybierz też przekliki (`@sciezka:<id>`, skill `przekliki-ogorkowe`).
2. **Stan przed.** Uruchom wybrane testy lokalnie: ok / czerwone / pominięte. Czerwony = HIPOTEZA: uruchom go sam 3 razy, przypisz klasę a) produkt, b) test lub niestabilność, c) środowisko. Nigdy "regresja" z samej lektury logu.
3. **Luki.** Dotknięte pliki bez testu dostają testy w kolejności: jednostkowy na zachowaniu (woła prawdziwy kod, nie regex po źródle) -> kontrakt lub przeklik ścieżki (metka ścieżki, `@jest`).
4. **Każdy nowy test: DWIE kontrole negatywne.** (a) zepsuj kod produkcyjny (odwrócony warunek, usunięta linia) -> test czerwony, przywróć; (b) zepsuj oczekiwanie w teście -> czerwony, przywróć. Potem test 3 razy zielony. Test, który nie czerwienieje, to deklaracja, nie bramka. Szczegóły: `references/kontrola-negatywna.md`.
5. **Staging: raz na falę.** Gałąź fali wdrożona na staging (podgląd PR albo wspólny staging), czekasz na gotowe wdrożenie, uruchamiasz TYLKO testy i przekliki z kroku 1 (plus ścieżki pieniędzy i dostępu, jeśli fala ich dotyka). **Jeden przebieg naraz na wspólnym stagingu**: nakładające się przebiegi dzielą limity i dają fałszywe czerwienie.
6. **Smoke ścieżek krytycznych przy pliku wspólnym.** Mapa plik -> ścieżka nie widzi zależności modułów wspólnych (narzędzia, sesja, zgoda na cookies, konfiguracja). Fala dotyka takiego pliku, pieniędzy, tożsamości albo dostępu: dołóż przekliki ścieżek o wadze 4-5, nawet jeśli mapa ich nie wskazała.
7. **CR tylko osi fali.** Skill `zakres-cr` na zakresie fali: jeden recenzent tylko do odczytu na oś (maks. 2; oś pieniędzy lub dostępu zawsze, jeśli dotknięta), poprawiacz w tej samej fali, czysta bramka zamknięcia. Poprawki spoza fali -> osobne zadanie, nie nowy push do fali.
8. **Zapadka.** Pokrycie i stan CR nie spadają względem stanu przed falą: ścieżek bez testów nie przybywa, testów dotkniętych ścieżek nie ubywa. 100% tylko na ścieżkach pieniędzy i dostępu.
9. **Raport (jedna strona):**

| pozycja | wynik |
|---|---|
| testy uruchomione | ok / czerwone (z klasą a/b/c) / pominięte |
| nowe testy | ile, każdy z dwiema kontrolami negatywnymi |
| przebieg po stagingu | które testy i przekliki, wynik |
| luki zostawione | które i dlaczego |
| CR | znaleziska, SHA poprawek, link PR |
| pytania | maks. 3, każde z rekomendacją |

## Pułapki

- **Produkcja w lokalnej konfiguracji.** Przed testami zapisującymi dane sprawdź, dokąd wskazuje konfiguracja (adresy, nie wartości kluczy). Testy piszące dane nigdy na produkcji.
- **Czerwony test bywa prawdziwym defektem.** Nie osłabiasz asercji.
- **Zmiana metki scenariusza zmienia zbiór pominiętych:** porównanie ze stanem przed po nazwach i liczbach, nie po samym "zielono".
- **Dysk i pamięć:** buildy i przeglądarki po jednym; przy kilku GB wolnego nie budujesz, sprzątasz artefakty testów.
- **"0 testów" bez błędu** to brak pomiaru, nie zielono: sprawdź liczbę.

## Czego ten skill NIE robi

Pełnej suity (T3), nadrabiania pokrycia starego kodu, wydania na produkcję, scalania PR (robi to użytkownik). Pojedyncza poprawka: `quick-fix-qa`. Pełny code review zakresu: `zakres-cr`.

## Jak sprawdzić, że runda działa

1. **Wsteczny test:** ostatni prawdziwy defekt z tej części aplikacji: czy zestaw z kroku 1 zawierałby test, który go łapie? Nie = popraw ścieżki w pliku projektu.
2. **Zasiany defekt:** mutacja w dotkniętym pliku na kopii gałęzi: zestaw MUSI zaczerwienić.
3. **Czas:** do 20 minut testów, raport do jednej strony.
