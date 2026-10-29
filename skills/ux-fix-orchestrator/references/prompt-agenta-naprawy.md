# Szkielet promptu agenta naprawy

Wypełnij `{...}` i wyślij agentowi (najlepiej w tle). Jeden agent = jeden rozłączny zakres plików.

```
Repo: {katalog repo} ({stos, np. React + Tailwind v4}). Zadanie: audyt odstępstw od kanonu UX/UI
+ WYKONANIE poprawek zgodności dla {NAZWA ZAKRESU}.

TWOJE PLIKI (tylko te wolno edytować, razem z ich testami): {lista katalogów}.
NIE dotykaj: {lista + POWÓD każdej pozycji: "inny agent", "świeżo zatwierdzone", "osobne zadanie"}.

{JEŚLI agent używa cudzych komponentów:}
Używasz komponentów z {ścieżka}, które równolegle edytuje inny agent. Możesz ich UŻYWAĆ,
nie edytujesz ich i nie zmieniasz ich API ani propsów. Problem w ich wnętrzu -> RAPORTUJ.

{JEŚLI jest znane znalezisko:}
ZNANE ZNALEZISKO: {opis + plik:linia + oczekiwany wzorzec naprawy z kanonu}.

ŹRÓDŁA REGUŁ (przeczytaj PRZED oceną):
1. Tokeny projektu: {pliki z pola ui.tokeny} - skala typografii, odstępów, promieni, warstw, kolorów.
2. Komponenty bazowe: {katalog z pola ui.komponenty} - używaj ich zamiast przepisywać klasy.
3. {Dokument zasad z pola ui.kanon - wypisz NUMERY lub nazwy zasad istotnych dla TEGO zakresu,
   każdą jednym zdaniem; agent nie zgaduje, które go dotyczą.}
4. Checklista (w konflikcie wygrywa: {werdykt z fazy 1, z datą}): dotyk >= 44 px i odstęp >= 8 px;
   kontrast drobnego tekstu >= 4,5:1, elementów UI i dużego tekstu >= 3:1; odstępy na siatce 4/8;
   tekst na zdjęciu wymaga przyciemnienia; cyfry tabelaryczne w liczbach i cenach; jedna grubość
   obrysu ikon; jedna skala cieni; przycinanie wieloliniowe zamiast twardego ucięcia; hierarchia
   rozmiarem, odstępem i kontrastem, nie samym kolorem.

CO ROBISZ:
1. Przeczytaj swoje pliki W CAŁOŚCI. Zbierz ODSTĘPSTWA w klasach: {klasy z klasy-defektow.md
   istotne dla zakresu, np. K1 token-widmo, K4 dzikie rozmiary tekstu, K6 cel dotyku}.
2. NAPRAW bezpiecznie naprawialne (podmiana na tokeny, rozmiary, odstępy, kontrasty).
   To poprawki ZGODNOŚCI, nie redesign: nie zmieniasz układu ani przepływu. Wątpliwe -> RAPORTUJ.
3. Po edycjach: sprawdzenie typów (exit 0) + testy TYLKO swoich plików. Test czytający źródło
   regexem czerwienieje przez Twoją poprawkę? Oceń: pilnuje starego napisu (przepisz na intencję,
   komentarz z datą) czy złapał regresję (cofnij).
4. ZERO commitów, zero serwera deweloperskiego, zero przeglądarki, zero pełnej suity.

RAPORT: (a) tabela odstępstw [co | plik:linia | reguła | naprawione TAK/NIE], (b) lista zmian,
(c) wynik typów i testów, (d) pozycje odłożone do decyzji użytkownika z uzasadnieniem.
```

## Dlaczego każdy element tam jest

| element promptu | co się dzieje bez niego |
|---|---|
| lista "NIE dotykaj" z powodem | agent "przy okazji" poprawia świeżo zatwierdzony komponent |
| zakaz zmian API współdzielonych | drugi agent przestaje się kompilować w połowie pracy |
| numery zasad kanonu, nie "przeczytaj kanon" | agent czyta wszystkie zasady i stosuje losowe trzy |
| werdykt hierarchii z datą | agent rozstrzyga konflikt po swojemu, niespójnie z innymi |
| testy tylko swoich plików | 10 razy wolniej, a i tak widzi przejściowe błędy innych agentów |
| instrukcja o testach czytających źródło | agent albo kasuje asercję, albo cofa dobrą poprawkę |
| zero commitów | kilka commitów zamiast jednego, nie do odkręcenia jednym revertem |
| "raportuj, nie ruszaj" przy wątpliwych | redesign przemycony jako poprawka zgodności |
| punkt (d) raportu | ginie lista odłożonych decyzji, a to najcenniejszy wynik |

## Liczba agentów

- Maks. 4 na turę: powyżej tego kolizje na komponentach współdzielonych rosną szybciej niż zysk z równoległości.
- Zakres nie dzieli się na 4 rozłączne katalogi -> dwie tury, nie dwóch agentów w jednym katalogu.
