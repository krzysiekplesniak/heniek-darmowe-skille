# Oś = ścieżka integracyjna

**Oś to jedna ścieżka biznesowa, którą przechodzi zmieniony kod**, recenzowana od początku do końca jako recenzja integracyjna. Nie "bezpieczeństwo" i nie "styl". Zmiana w jednym pliku bywa widoczna dopiero w skutku na ścieżce (np. płatność -> zamówienie -> dostęp -> e-mail).

## Skąd bierzesz ścieżki

Z konfiguracji projektu `.claude/projekt-heniek.json`, pole `sciezki` (id, nazwa, kategoria, globy plików). Jeśli lista jest pusta, wyznacz ją z użytkownikiem (2–5 ścieżek) i dopisz do konfiguracji, zanim wybierzesz osie.

## Jak wyznaczyć zbiór plików osi

1. Zacznij od plików **zmienionych** w zakresie.
2. Dla każdej ścieżki z konfiguracji sprawdź, czy któryś zmieniony plik leży na niej: wyszukaj import/użycie zmienionych symboli w górę (kto wywołuje) i w dół (co wywołuje) aż do granicy ścieżki: wejście (ekran, endpoint, webhook) i wyjście (zapis do bazy, wiadomość, odpowiedź).
3. Zbiór osi = zmienione pliki + ich bezpośredni konsumenci na ścieżce + testy ścieżki.
4. **Lista testów osi pochodzi z mapowania plików na testy** (`mapa-testow.mjs` z `test-epiku`; bez niego wyszukanie testów, które importują pliki osi), **nie z wyboru agenta**. Agent uruchamia dokładnie tę listę; brakujący test to znalezisko klasy LUKA TESTOWA.
5. Pliki zmienione bez żadnej ścieżki: wiersz "oś: N/D, brak ścieżki" z listą plików i krótki przegląd ogólny (nie osobna oś).

## Jeden recenzent = jedna oś

Ścieżek dotkniętych jest N, recenzentów N. Recenzent dostaje: diff, listę plików osi, listę testów osi i **klasy defektów do sprawdzenia wprost w zleceniu** (nie dostaje Twojego uzasadnienia zmiany).

## Klasy defektów do wpisania w zlecenie recenzenta

- pole wychodzące do klienta bez bramki dostępu (propsy komponentu klienckiego, odpowiedź API);
- "ciche puste": przechwycony błąd zamieniony na pustą listę albo kod błędu bazy czytany jako "ok" bez śladu w logu;
- asercje kolejności i limitu nieobjęte testem;
- testy wyrażeniem regularnym po źródle;
- zdublowane stałe i wyrażenia zamiast importu;
- rzutowanie typu na danych z bazy bez strażnika;
- strefa czasowa w datach UI;
- nowa wartość w unii/enumie nieobsłużona w jakimś `switch` albo mapie;
- zmiana kształtu odpowiedzi bez aktualizacji konsumentów.

## Zasady dla recenzenta

1. Każde znalezisko ma konkretne wejście lub stan i konkretny skutek; "kod mógłby być czystszy" nie jest znaleziskiem.
2. Liczby z opisu zmiany przelicz samodzielnie (opis "we wszystkich 4 wywołaniach" bywa fałszywy).
3. Plik czytasz z recenzowanej gałęzi (`git show origin/<gałąź>:<plik>`), nie z bieżącej kopii roboczej.
4. Wprowadzasz defekt, który nowa bramka ma łapać, uruchamiasz ją, potwierdzasz czerwień i **cofasz** (kontrola negatywna): opis w skillu `quick-fix-qa-plus` (leży obok tego skilla), plik `kontrola-negatywna.md` w jego katalogu `references`.
5. Nie uruchamiasz produktu, więc oddzielasz **zmierzone** od **argumentów z lektury**.
