# RURA i procedura A–H (pełny tekst)

## Kontrakt wejścia i wyjścia

Zakres podajesz jako PR, gałąź, epik, commity, pliki albo oś. Na końcu dostajesz czysty PR i jedną listę pytań, a nie coś, co siedzi w „decyzji", „niezweryfikowane" albo „CR jest, poprawki nie ma". Pilnowanie tego nie spada na właściciela: robi to ORK.

Zakończenie etapu sprawdza ORK skryptem (`cr-bramka-zamkniecia.mjs` w etapie F, `cr-zakresy.mjs` w etapie A), nie pamięcią.

## Definicja osi

**Oś to ścieżka biznesowa / klienta, od wejścia do skutku — nie wymiar, z którego da się spojrzeć na diff.**

Przykłady osi: zakup, płatność, zamówienie, odzyskanie dostępu, logowanie, nawigacja, panel administracyjny. Katalog ścieżek to pole `sciezki` w `.claude/projekt-heniek.json` (id, nazwa, kategoria, globy). Pliki → ścieżka: globy z katalogu albo `cr-zakresy.mjs --pokrycie --sciezka=<id>`.

| reguła | treść |
|---|---|
| **Liczba osi = liczba ścieżek, które diff faktycznie dotyka** | zwykle 1, rzadko 2–3. Nie dokładasz osi „dla pewności" i nie dzielisz jednej ścieżki na „API / UI / silnik / testy" |
| **1 agent = 1 oś-ścieżka** | recenzent czyta zmienione pliki ORAZ ich konsumentów na tej ścieżce i przechodzi ją od wejścia do skutku (styki, dane zapisane przed zmianą, stany błędu) |
| **Test po osi — zawsze** | recenzent uruchamia celowane testy TEJ ścieżki z listy z pomiaru (`mapa-testow.mjs` z `test-epiku`), nie z wyboru agenta. Brak testu = znalezisko klasy LUKA TESTOWA, nie powód do pominięcia. E2E i przeklik nie są częścią recenzenta (patrz `limit-rund-i-luka-testowa.md`) |
| **Pliki poza ścieżką** (dokumenty, konfiguracja, same testy) | nie są osią i nie dostają agenta: sprawdza je skrypt (typy, testy jednostkowe) albo ten sam recenzent jako dodatek |
| **Diff dotyka > 3 ścieżek** | pierwsza fala: 3 ścieżki o najwyższej wadze (pieniądze, tożsamość, dostęp najpierw). Pozostałe — druga fala recenzentów w tej samej rundzie. Pominąć ścieżkę wolno tylko z powodem w tabeli pokrycia |
| **Tabela pokrycia ścieżek — obowiązkowa** w etapie A i w raporcie | każda ścieżka dotknięta diffem: `zrecenzowana (fala k, agent)` albo `pominięta: <powód>`. Ścieżka bez wiersza = błąd planu |
| **Projekt bez katalogu ścieżek** | zbuduj katalog z diffu i tras aplikacji (id, nazwa, waga, globy) i zacommituj go razem z falą. Osie z pamięci są zakazane |
| **Słownictwo** | „trzy osie" (gałąź / epik / obszar) to trzy sposoby WYBORU zakresu. „Soczewki ryzyka" to audyt kodu już scalonego (bez diffu). Żadne z nich nie jest liczbą agentów do zwykłej fali CR |

Do sekcji fali (etap A) wpisujesz: pliki → ścieżka `id` → jeden agent. Jeśli lista agentów ma więcej wierszy niż dotkniętych ścieżek, to błąd planu.

## Procedura A–H

| etap | kto | co | koniec etapu = |
|---|---|---|---|
| **A. Przyjęcie zakresu** | ORK + pomiar | zakres podany → bierz go; brak → menu (`kroki-skryptowe.md`, `cr-zakresy.mjs --dni=1`). Policz bazę i HEAD. Listę plików bierz z `git diff --name-only <baza>...<glowa>` i z pokrycia (`cr-zakresy.mjs --pokrycie --zakres=<baza>...<glowa> --status=NIGDY,NIEAKTUALNY`). Załóż sekcję `## Fala <id>` w rejestrze z listą plików w backtickach i ścieżką każdego pliku | sekcja fali zapisana, tabela pokrycia gotowa |
| **B. Recenzja** | recenzenci read-only, 1 agent = 1 oś-ścieżka, model jawny; test osi wg listy z pomiaru | zwracają znaleziska ze scenariuszem awarii; dowód z `git show origin/<gałąź>:<plik>`; **nie piszą do żadnego worktree** | raport w wyniku agenta |
| **C. Triage** | ORK | każde znalezisko dostaje **kanoniczne ID** z rejestru (nie numer recenzenta — numery się rozjeżdżają) i jeden stan: POPRAWKA / `PYTANIE Qn` / `OBALONE` (z dowodem) / `CZYSTO`. Wpis do rejestru zaraz, nie zbiorczo | każdy wiersz ma ID i stan |
| **D. Poprawiacze** | 1 agent = 1 klasa defektu, katalog roboczy fali, bez własnej gałęzi | **najpierw weryfikuje przesłankę** (może OBALIĆ); naprawa; **dowód czerwieni**: test lub komenda, która pada na starym kodzie, z wynikiem w kolumnie DOWÓD; kontrola negatywna; grep rodzeństwa i konsumentów; poprawia pliki w katalogu roboczym i zgłasza listę zmian (pliki, ID, dowód); **nie commituje i nie pushuje**, commit z ID w treści robi koordynator na gałęzi `cr/<fala>`. Trwały test regresji pisze `test-epiku` (autor inny niż autor poprawki) | lista zmian; SHA po commicie koordynatora, wpisany w kolumnę `SHA` |
| **E. Integracja** | ORK albo agent integratora | jedna gałąź `cr/<fala>` od bazy; **przed każdym merge `git diff --stat <baza>...<galaz>`** — plik spoza klasy = STOP (gałąź może wciągnąć cudzą funkcję albo migrację); konflikty; **testy na złączonym HEAD** (typy, testy jednostkowe, celowane osi) | złączony HEAD zielony |
| **F. Bramka zamknięcia** | skrypt `cr-bramka-zamkniecia.mjs --fala=<id> --baza=<ref> --glowa=<ref>` | (a) każdy wiersz w stanie `NAPRAWIONE / OBALONE / PYTANIE Qn / CZYSTO`; (b) każdy SHA `NAPRAWIONE` istnieje i jest przodkiem głowy; (c) każdy commit nie-merge w `baza..glowa` przypisany do znaleziska albo do „Commity bez znaleziska"; (d) każde `PYTANIE Qn` ma Qn w liście pytań; (e) `OBALONE` ma DOWÓD; (f) REJESTR-CR ma wiersz `Fala <id>`; (g) `CZYSTO` ma niepusty opis w kolumnie „OPIS SPRAWDZENIA”; (h) opcjonalna kolumna Rundy: wartość > 2 bez „wyjątek: …” = naruszenie. Kod 1 → wracasz do C/D, **nie do właściciela**; kod 2 → brak pomiaru, napraw rejestr lub polecenie | kod 0 |
| **G. Wyjście** | ORK | szkic PR (`gh pr create --draft` albo odpowiednik); po zielonym wyniku na SHA głowy oznacz gotowy; w opisie tabela znalezisko → SHA → pliki. **W TEJ SAMEJ wiadomości** lista pytań Q1..Qn, każde z rekomendacją | 1 link PR + 1 lista |
| **H. Rejestry** | ORK | wiersz w REJESTR-CR (zakres, pliki, data, rundy, luki), sekcja fali zamknięta, worktree `fix/<fala>-*` usunięte (najpierw odłącz współdzielone katalogi zależności, żeby nie skasować cudzych plików) | drzewo czyste |

Po etapie F ORK zleca testy: celowane e2e wg `test-epiku` oraz, gdy fala dotyka stanu współdzielonego między ekranami, `przeklik-mieszany` (jeśli masz ten skill) na złączonym HEAD. Ich wynik idzie do opisu PR. To nie są etapy CR i CR ich nie wykonuje.

⚠️ **Format sekcji, który bramka WYMAGA** (nagłówek dosłownie `## Fala <id>`):

```markdown
## Fala <id>

| # | STAN | SHA | DOWÓD |
|---|---|---|---|
| PT-5 | NAPRAWIONE | `abc1234` | `test-x czerwony na starym kodzie: <wynik>` |
| A-9 | OBALONE | — | komenda + wynik obalający |
| EM-5 | PYTANIE Q1 | — | — |
| PT-7 | CZYSTO | — | oś zrecenzowana, testy osi zielone |

### Commity bez znaleziska
| SHA | Powód |
|---|---|

### Pytania
| Q | Decyzja | Znaleziska | Rekomendacja |
|---|---|---|---|
| Q1 | ... | EM-5 | ... |
```

Słownik stanów to dokładnie `NAPRAWIONE / OBALONE / PYTANIE Qn / CZYSTO`. Kolumny `Status` i `SHA naprawy` bramka też akceptuje, ale nie inne słowa. Stary format z osobną sekcją na pytania i mapę gałęzi bramka odrzuca jako nieczytelny (kod 2).

Ustalenie właściciela 3.11 (projekt unifikacji, pkt 4): ten jeden słownik obowiązuje wszędzie — w skillu, w bramce i w raportach. Dawny podział na `NAPRAWIONE W PR / PYTANIE / ODRZUCONE` jest wycofany.

## Raport postępu — po KAŻDYM powrocie agenta

Najpierw 1–3 zdania, co wróciło (ID znalezisk, SHA, co obalone lub sprostowane). Potem **tabela stanu**, zawsze te same wiersze, liczby aktualne:

| Stan | |
|---|---|
| **W PR — gotowe z SHA** | N gałęzi, N commitów, zamykają **N znalezisk** (w tym N blokerów) |
| **W PR — w toku (fala k)** | N poprawiaczy: tematy po przecinku → kolejne **N znalezisk** |
| **FALA k+1 (bez decyzji właściciela)** | ~N pozycji — kiedy rusza |
| **Pytania** | N punktów, każdy z rekomendacją — dostaniesz je razem z PR-em, jedną listą |

Pytania pojawiają się tylko w etapie G. Wiersz o wartości 0 zostaje z zerem.
