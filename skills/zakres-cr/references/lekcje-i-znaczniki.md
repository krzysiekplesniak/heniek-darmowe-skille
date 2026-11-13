# Lekcje — skąd każda reguła — i znaczniki ryzyka

## Skąd każda reguła

| zdarzenie | reguła |
|---|---|
| trzy fale recenzji bez poprawiaczy: dużo znalezisk, zero poprawek | etap D w tej samej fali co B |
| recenzenci pisali poprawki do wspólnego katalogu recenzji, część została osierocona | B read-only; poprawki tylko w worktree poprawiacza, koniec = push |
| numeracja recenzenta rozjechana z rejestrem (ten sam defekt, dwa numery) | C: kanoniczne ID nadaje orkiestrator |
| scalenie gałęzi wciągnęło niezamówioną funkcję i migrację | E: `diff --stat` przed każdym merge; F(c): każdy commit przypisany |
| twierdzenie orkiestratora o kroku CI okazało się błędne (obalone przez poprawiacza) | D: poprawiacz najpierw weryfikuje przesłankę |
| agenci odziedziczyli najdroższy model zamiast zamierzonego | jawny model przy każdym agencie |
| osobne PR-y per poprawka, pytanie właściciela „i dalej osobne PR?" | gałęzie robocze wewnętrzne, PR jeden (E, G) |
| pytania rozsiane po czacie, decyzje parkowane cicho | pytania tylko w G, jedną wiadomością; F(d) pilnuje, że każda jest na liście |
| commit rejestru padł na blokadzie hooka (fixery commitowały równolegle) | czekanie na mutex, nigdy `--no-verify` |
| testy czytające plik źródłowy i porównujące tekst były zielone po zepsuciu działania (13 z 13) | test woła prawdziwy kod; kontrola negatywna obowiązkowa |
| przegląd jednostkowy i typy dały „zero blokerów", a przeklik uruchomionej aplikacji znalazł kilka defektów stanu między ekranami; test jednostkowy wołał funkcję inną ścieżką niż produkcja | E3: przeklik stanu współdzielonego jako bramka; test przepływu woła ścieżkę produkcyjną; przegląd nie jest mocnym dowodem dla fal dotykających stanu współdzielonego |

## Trzy reguły z praktyki — bez nich metoda zawodzi po cichu

**R1. Skill i dokumenty MUSZĄ być widoczne dla agenta, inaczej dostanie twoje streszczenie.** Zdarzyło się: epik leżał na gałęzi bez wypchnięcia, agent go nie przeczytał, pracował ze specyfikacji w zleceniu i zrobił zadanie na innym zestawie powierzchni, niż mówił dokument. Dokumenty źródłowe wypchnij, zanim się na nie powołasz.

**R2. Przegląd kończy się WERDYKTEM z bramki, nie opisem.** Każdy agent oddaje wynik definicji ukończenia (`DoD N/6`, `Dowód N/4`, wg `quick-fix-qa-plus`). Warstwa niezmierzona zostaje z ⚪ **i komendą** — usunięcie wiersza dla ładniejszej tabeli jest cięższym błędem niż samo niezmierzenie.

**R3. Sprawdzaj BRAMKI, nie tylko kod.** W praktyce znaleziono testy, które nie mierzą zachowania: jeden zzieleniał od samego komentarza z pasującym tekstem, dwa inne zostały zielone po zepsuciu działania bez zmiany napisu. Wszystkie trzy przez dłuższy czas uchodziły za dowód. Test: **zepsuj ZACHOWANIE bez zmiany tekstu** — jeśli bramka zostaje zielona, pinuje kształt i jest deklaracją, nie bramką.

## Zakaz oddawania raportu bez poprawek

Przegląd bez wdrożonych poprawek nie jest wykonany. Raport „znaleziska są, poprawki potem" to niedokończona praca. Poprawiacz rusza w tej samej fali, a pytania idą na listę na wyjściu.

## Znaczniki ryzyka

| Znacznik | Ścieżka | Dlaczego podbija kolejność |
|---|---|---|
| `PIENIADZE` | płatności, webhooki, checkout, uprawnienia, zamówienia, kupony | defekt = zapłacił i nie dostał, albo dostał i nie zapłacił |
| `DOSTEP` | tożsamość, linki logowania, tokeny, sesje | defekt = cudza tożsamość albo zamknięty produkt opłacony |
| `MIGRACJA` | katalog migracji bazy danych | jedyna rzecz w repo, której się nie cofa pushem |
| `DANE-KLIENTA` | alarmy, poczta, powiadomienia wychodzące | defekt wychodzi na zewnątrz, do cudzej skrzynki |
| `CI` | konfiguracja potoku ciągłej integracji | defekt gasi bramki, a zielone zostaje zielone |

Znaczniki są **heurystyką po ścieżkach**, nie werdyktem. Brak znacznika nie znaczy „bezpieczne" — znaczy „nie trafiło we wzorzec".

## Reguły statyczne przed przeglądem modelowym

Zanim ruszy recenzent modelowy, uruchom reguły statyczne projektu (jeśli są) na zmienionych plikach. Trafienia są znaleziskami z automatu: wpisz je do rejestru jak każde inne, z `plik:linia`. Recenzent modelowy pomija klasy pokryte regułami statycznymi i recenzuje resztę. Fałszywy alarm: popraw regułę albo dopisz wyjątek z uzasadnieniem. Nowa klasa znaleziona przez model powtórzona dwa razy: nowa reguła, z testem (przykład łapany + czysty).

Wniosek metodyczny: zawężenie zakresu do plików wskazanych pomiarem nie jest kompromisem jakości — jest warunkiem, żeby recenzent w ogóle dotarł do właściwego miejsca. Ślepy przegląd całego diffu kosztuje więcej i nie gwarantuje, że recenzent trafi na defekt siedzący w środku dużego pliku.

## Czego ta metoda NIE robi

Nie uruchamia pełnego kontraktu ani wszystkich przeklików (to przebieg nocny albo przed wydaniem), nie nadrabia pokrycia starego kodu hurtem (osobna praca), nie audytuje wydania (osobny skill), nie wydaje na produkcję. Do nadzoru pojedynczego zadania z DoD: `quick-fix-qa-plus`. Do testów fali: `test-epiku`.
