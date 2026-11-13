# Kontrola negatywna — procedura

**Kontrola pozytywna** (warunek 3 DoD) pyta: *czy moja sonda w ogóle widzi różnicę?*
**Kontrola negatywna** (warunek 6 DoD i recenzent w fazie 5) pyta: *czy moja bramka w ogóle łapie defekt?*
To dwa różne pytania i żadne nie zastępuje drugiego.

⛔ **Żelazna zasada:** bramka, której nie widziałeś na czerwono, nie jest bramką. Jest deklaracją.
Nowa bramka, która od razu przechodzi, jest **podejrzana**.

## Cztery kroki, w tej kolejności

1. **Nazwij defekt, który bramka ma łapać** — jednym zdaniem, ZANIM go wprowadzisz.
   Nie „zepsuję coś", tylko „usunę atrybut `muted` z elementu wideo".
2. **Wprowadź go w kopii roboczej.** Najmniejszą możliwą zmianą. Jeśli musisz zepsuć trzy rzeczy naraz, żeby bramka zczerwieniała — bramka mierzy coś innego, niż myślisz, i to jest znalezisko.
3. **Uruchom bramkę i przeczytaj KOMUNIKAT, nie tylko kolor.** Czerwień z komunikatem „nie znaleziono pliku" nie jest dowodem, że bramka działa — jest dowodem, że zepsułeś przebieg. Komunikat musi nazywać TEN defekt.
4. **Cofnij zmianę i potwierdź czysty status.** Porównaj plik z kopią sprzed pomiaru. Kontrola negatywna, która zostawia ślad w drzewie, jest gorsza niż jej brak.

## Bez `git stash`

Stos stash jest współdzielony między wszystkimi katalogami roboczymi i sesjami, więc `git stash` (także `pop`) może zabrać albo przywrócić cudzą pracę. Nigdy go nie używaj do kontroli negatywnej. Zamiast tego:

1. Skopiuj plik do katalogu tymczasowego sesji (`cp <plik> <scratch>/<plik>.orig`).
2. Wprowadź defekt w pliku, sprawdź diff, uruchom test i przeczytaj komunikat.
3. Przywróć plik z kopii (`cp <scratch>/<plik>.orig <plik>`) albo, gdy plik był wcześniej niezmieniony względem HEAD, `git checkout -- <plik>`. Gdy plik miał niezacommitowane zmiany, przywracasz wyłącznie z kopii, bo `git checkout` by je skasował.
4. Potwierdź czysty stan: `git diff -- <plik>` pokazuje tylko to, co było przed pomiarem.

Uwaga operacyjna: komenda testów to `komenda_testow` z profilu albo `package.json`, nie goły `node --test` (w repo z TypeScriptem potrzebne są flagi transpilera; przykład: `node --experimental-strip-types --import <rejestr-transpilera> --test <pliki>`, gdzie rejestr transpilera to plik projektu z `package.json`). W Git Bash na Windows `python3` bywa atrapą i wiesza polecenie; używaj `node`.

## Trzy sposoby, na które ta procedura zawodzi po cichu

| pułapka | jak wygląda | co zrobić |
|---|---|---|
| **podmiana, która nie trafiła** | wprowadzasz defekt komendą edycji tekstu, komenda nic nie podmienia, bramka jest zielona — a ty raportujesz, że „przeszła kontrolę" | po każdej podmianie **sprawdź diff**, nie zakładaj. Zdarzało się, że wzorzec nie pasował do końca linii i raport ogłosił pełny wynik jako dowód działania bramki; po poprawnym przebiegu wyszło 15 pass i 1 FAIL |
| **czerwień z innego powodu** | bramka pada, ale na błędzie środowiska — brak zmiennej, brak zależności, zły katalog | przeczytaj komunikat. Musi nazywać defekt, który wprowadziłeś |
| **bramka pinuje KSZTAŁT, nie zachowanie** | czerwienieje po zmianie formatowania albo znaku końca linii, a nie po zmianie działania | zepsuj **zachowanie** bez zmiany tekstu i sprawdź, czy nadal czerwienieje. Jeśli nie — to nie jest bramka zachowania |

## Kiedy N/D — i jak to zapisać

Zadanie **audytowe** nie ma czego cofać: warunek 6 dostaje **N/D z jednozdaniowym powodem** („audyt, nie naprawa — nie ma stanu sprzed"). To jest dozwolone i ma być jawne. Ciche pominięcie warunku 6 jest cięższym błędem niż napisanie N/D.
