# Artefakty pomiaru — zanim ogłosisz wynik

**Sonda, która daje ZERO, częściej jest zepsuta niż prawdziwa.** Zero to wynik podejrzany z definicji: mierzenie nieobecności udaje się także wtedy, gdy patrzysz w złe miejsce. Zanim ogłosisz „tego nie ma", przejdź tę listę.

| # | artefakt | jak wygląda | jak go wykluczyć |
|---|---|---|---|
| **1** | **dziura we własnym wzorcu** | „zero elementów o danej nazwie", a wzorzec z granicą słowa nie łapie wariantu zapisu | policz najpierw BEZ filtra, potem z filtrem. Rozjazd liczb jest kontrolą pozytywną |
| **2** | **trafiłeś w ukrytą kopię DOM** | element istnieje, ale ma zerowy rozmiar i nie jest widoczny | policz WSZYSTKIE wystąpienia i podaj rozmiar każdego. Jeśli jest ich więcej niż jedno — powiedz to |
| **3** | **komponent czeka na zdarzenie** | pusty, bo obserwator przewijania nie odpalił: nie doscrollowałeś | doscrolluj, odczekaj, zmierz PONOWNIE. Dopiero drugi zerowy wynik coś znaczy |
| **4** | **zerowy viewport** | odczyt zwraca pustą stronę, klik ląduje w punkcie (0,0) | sprawdź wymiary okna. Ukryty panel = brak układu = brak pomiaru |
| **5** | **mierzysz artefakt, nie runtime** | liczysz na pliku wygenerowanym offline zamiast na żywym API | to warstwa 1, nie 4. Podaj ją jako 1 |
| **6** | **świeży katalog roboczy bez artefaktów budowania** | testy czerwienieją masowo w NOWYM katalogu, a na gałęzi obok są zielone | katalogi generowane (wynik budowania, zależności, cache) są ignorowane przez git i NIE przychodzą z `git worktree add`. Zbuduj je albo uruchom test tam, gdzie już są |

⭐ **Reguła domykająca: pierwszy zerowy wynik nie jest wynikiem, tylko hipotezą.** Zerowy pomiar zgłaszasz dopiero wtedy, gdy umiesz pokazać, że ta sama sonda daje NIEzerowy wynik w stanie, w którym powinna. To kontrola pozytywna z warunku 3 DoD, przeniesiona na pomiar w przeglądarce.
