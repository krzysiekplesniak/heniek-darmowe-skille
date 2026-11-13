# Tryb lokalny: ORK w oknie, agenci w oknie, jeden katalog

Rdzeń (`SKILL.md`) jest ten sam we wszystkich trybach. Ten plik opisuje WYŁĄCZNIE to, co wynika z miejsca pracy: wykonawca, kanał pytań, kolejka i równoległość, izolacja, przeglądarka. Reguły procesu (rura, stany luk, kontrole negatywne, limit rund, zapadka, bramka) się tu nie zmieniają.

Wariant pracy lokalnej: A+C. Kolejność pilnują koperta i walidatory skilla `paczka-joba` (jeśli masz ten skill; bez niego zlecenie idzie tekstem z tymi samymi polami, a zakres sprawdzasz `git diff --name-only`). Skille są agentami. Bez izolacji worktree.

## Wykonawca i kolejka

- Wykonawcą jest ORK i agenci uruchamiani w jego oknie (narzędzie Agent), każdy z **jawnym `model`**. Model dobiera tabela w konfiguracji projektu. Domyślnie tańszy do testów jednostkowych, integracyjnych i zwykłych e2e; mocniejszy do ścieżek pieniędzy, tożsamości i dostępu. Dwie nieudane próby tańszego modelu w jednej luce: kolejna próba mocniejszym.
- Limity okna: do 3 agentów piszących naraz, do 5 tylko do odczytu. Ciężkie testy po jednym. Agenci nie zabijają procesów, nie zakładają katalogów roboczych, nie instalują zależności.
- Główny wątek ORK nie robi długiej pracy: etap D (pisanie) i etap G (uruchomienie) idą do agentów w tle z jasnym zleceniem (cel, miejsce, czego nie wolno, jaki dowód oddać). Wynik wraca jako powiadomienie; ORK sprawdza dowód, commituje, aktualizuje stan, raportuje.
- Stan fali zapisujesz w pliku stanu: claim kroku PRZED startem agenta, zakończenie z SHA. Wznowienie po kompakcji lub restarcie idzie z pliku, nie z pamięci. Krok `w-toku` bez zakończenia to „przerwany, powtórz”, nigdy zielone.

## Koperta i agenci pisarze

Każdy agent dostaje zlecenie paczką `testy` skilla `paczka-joba` (jeśli masz ten skill; kroki 1 i 4 to jego walidatory, bez niego zrób je ręcznie):

1. `koperta-waliduj` przed startem. Kod różny od 0 = agent nie startuje.
2. W kopercie: ścieżka klienta, lista luk (numery wierszy z etapu C), `zakres.pliki` (globy NOWYCH plików testów tego agenta), `zakres.poza_zakresem`, wymagane dowody (testy, kontrola negatywna), scenariusze tekstem (jeśli są), lista znalezisk CR.
3. **Listy plików rozłączne.** Dwóch kopert z nakładającymi się globami nie uruchamiasz naraz. Wspólne rejestry testów (przypisania, tory, listy) nie są w żadnej kopercie: edytuje je ORK w etapie F.
4. Raport agenta: blok `json raport`; `raport-waliduj` porównuje listę zmienionych plików z gitem (zakres mierzy git, nie deklaracja agenta).
5. **Autor testu różny od autora kodu:** agent pisarz dostaje zlecenie z kryteriami, scenariuszami i listą luk. Kod danej luki czyta tylko po to, by go podpiąć. Identyfikator zlecenia kodera i zlecenia testów zapisz w stanie fali, żeby bramka mogła je porównać.
6. Samokontrola i etap E to osobny agent w czystym kontekście. Agent pracy sam siebie nie ocenia.

## Bez izolacji worktree: skutki dla testów

Wszyscy agenci pracują w jednym katalogu, na jednej gałęzi. Z tego wynika:

- **Pisanie i uruchamianie są rozdzielone barierą.** Agent może uruchomić wyłącznie własny nowy plik, solo, wstępnie. Kontrole negatywne robi na kopii w katalogu tymczasowym sesji, nigdy w drzewie roboczym. Przebiegi, które liczą się jako dowód (3x solo, warstwy, zapadka), wykonuje ORK po zakończeniu WSZYSTKICH agentów piszących. Powód: test uruchomiony w trakcie cudzej, niedokończonej zmiany pada z przyczyn, których nie ma w kodzie ani w teście.
- **Czerwony przed barierą nie ma klasy.** Zanim nazwiesz klasę (produkt, test, środowisko), powtórz po barierze. Czerwony z powodu cudzego pliku w połowie edycji to klasa (c).
- `git status` po pracy agenta pokazuje wyłącznie jego nowe pliki testów (`??`). Każdy inny plik to naruszenie koperty (czerwone z nazwą powodu).
- Bez izolacji nie ma wspólnego baseline. Kontrolę czerwony-na-starym-kodzie dla testów z CR robisz na kopii plików w katalogu tymczasowym.

## Kanał pytań

Pytania agentów wracają jako `zablokowane` z pytaniem i rekomendacją w raporcie (`pytania[]`). Agent nie pyta człowieka w trakcie. ORK zbiera je i zadaje właścicielowi RAZ, w jednej liście na wyjściu (etap H). Prace nie czekają na odpowiedź, jeśli nie są od niej zależne.

## Przeglądarka i środowisko

- Testy przeglądarkowe (e2e celowane) biegną headless na komputerze, po jednym, z wolnym dyskiem sprawdzonym przed startem. Poniżej progu z konfiguracji: nie buduj, zgłoś jako pytanie.
- Przeglądarka zalogowana właściciela służy tylko do ręcznego odtworzenia czerwonego (ustalenie klasy), nigdy do przebiegów testów. Naraz JEDEN agent w niej.
- Zmienne środowiska stagingu ustawiasz dla procesu, nie przez podmianę pliku w katalogu roboczym. Płatności i dane klientów: zero (testowe konta i karty testowe).
- Commit z długim hookiem uruchamiaj w tle i nie nakładaj dwóch commitów naraz. Nigdy z pominięciem hooków.

## Czego tryb lokalny NIE zmienia

Rury, stanów luk, limitu rund, reguły „test poprawiacza nie jest pisany drugi raz”, kontroli negatywnych, zapadki, bramki testów i formatu wyjścia. Jeśli tu pojawi się reguła dotycząca procesu, a nie miejsca pracy, przenieś ją do `SKILL.md`.
