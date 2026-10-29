# Kontrola negatywna: test, który nie czerwienieje, nie jest bramką

Zielony test mówi tylko, że coś przeszło. Nie mówi, czy test w ogóle **umie** się zaczerwienić. Kontrola negatywna to sprawdzenie tego wprost.

## Dwie kontrole na każdy nowy test

| kontrola | jak | oczekiwany wynik |
|---|---|---|
| (a) mutacja kodu | w kodzie produkcyjnym odwróć warunek, usuń linię, zmień stałą graniczną (`<` na `<=`), zwróć wcześniej | test CZERWONY, komunikat nazywa ten defekt |
| (b) zepsute oczekiwanie | w teście zmień oczekiwaną wartość na błędną | test CZERWONY |

Po każdej kontroli przywracasz stan (`git diff` pusty dla mutowanego pliku) i uruchamiasz test 3 razy: ma być zielony za każdym razem.

## Testy, które udają bramkę

| słabość | objaw | naprawa |
|---|---|---|
| regex po źródle | test czyta plik `.tsx` i szuka napisu; zostaje zielony po zepsuciu zachowania, bo napis został (albo zieleni od samego komentarza z pasującym tekstem) | test woła prawdziwy kod: render, wywołanie funkcji, żądanie do trasy |
| atrapa ignorująca warunek | atrapa zwraca zawsze to samo, więc sortowanie, limit albo filtr nie są sprawdzane | atrapa z danymi, które ujawniają warunek (nieposortowane, ponad limit) |
| test kształtu | sprawdza, że pole istnieje, nie jaką ma wartość w danym przypadku | asercja na wartości w konkretnym scenariuszu |
| test pominięty | `skip`, `only` w innym pliku, warunek środowiska, który zawsze pomija | uruchom z listą testów i porównaj liczbę |
| zła warstwa | jednostkowy zielony, bo woła funkcję inną ścieżką niż produkcja | test przez tę samą ścieżkę wywołania co produkcja albo przeklik |

## Zapis w raporcie

```
| test | (a) mutacja | (b) oczekiwanie | 3x zielony |
|---|---|---|---|
| cart.test.ts: limit 10 sztuk | `<=` na `<`: czerwony | 10 na 11: czerwony | tak |
```

Wiersz bez obu kontroli nie wchodzi do liczby "nowe testy".
