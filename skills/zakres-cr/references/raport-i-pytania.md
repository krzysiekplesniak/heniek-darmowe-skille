# Raport CR i lista pytań

## Raport postępu (po każdym powrocie agenta, zawsze ten kształt)

```
CR <zakres> | runda <1|2> | <etap A-H>
znaleziska: <kandydaci> kandydatów / <NAPRAWIONE> naprawionych (SHA) / <OBALONE> obalonych / <PYTANIE> pytań / <CZYSTO> czystych
testy osi: <liczba plików> uruchomionych, <pass>/<fail>; luki testowe: <liczba>
następny krok: <jedno zdanie>
```

Najwyżej 5 linii. Bez diffów, bez wklejonych plików.

## Tabela zamknięcia (w opisie PR)

| id | kandydat | stan | dowód (`plik:linia` albo polecenie + wynik) | SHA poprawki | klasa luki testowej |
|---|---|---|---|---|---|
| CR-1 | <objaw w zdaniu> | NAPRAWIONE | `modul/plik.ts:42` (czerwień: <wynik>) | `a1b2c3d` | atrapa ignoruje limit |
| CR-2 | <objaw> | OBALONE | `git show origin/<gałąź>:<plik>` → <wynik> | — | — |
| CR-3 | <objaw> | PYTANIE Q1 | `modul/plik2.ts:7` | — | — |
| CR-4 | <objaw> | CZYSTO | oś zrecenzowana, testy osi zielone | — | — |

Reguły: każdy wiersz ma stan z czterech (`NAPRAWIONE / OBALONE / PYTANIE Qn / CZYSTO`) i dowód; każdy `NAPRAWIONE` ma SHA; każdy `PYTANIE Qn` ma numer pytania; klasa luki wpisana przy każdej POPRAWCE. Pod tabelą: liczba plików osi i liczba uruchomionych testów.

## Bramka zamknięcia (przed oznaczeniem PR jako gotowy)

Uruchom `node <skill>/scripts/cr-bramka-zamkniecia.mjs --fala=<id> --baza=<ref> --glowa=<ref> --tabela` i przeczytaj wynik. Ręczna lista, gdy skryptu nie ma:

1. Brak wierszy w stanie innym niż `NAPRAWIONE` / `OBALONE` / `PYTANIE Qn` / `CZYSTO`.
2. Każde `NAPRAWIONE` ma SHA, który jest przodkiem głowy (`git merge-base --is-ancestor <sha> <glowa>`).
3. Testy osi uruchomione na **złączonym** stanie, wynik w opisie.
4. Każda poprawka ma dowód czerwieni na starym kodzie (kontrola negatywna).
5. Rejestr znalezisk (`cr.rejestr_znalezisk` z `.claude/projekt-heniek.json`) zgadza się z tabelą, a REJESTR-CR (`cr.rejestr_cr`) ma wiersz `Fala <id>`.

Kod 0 tylko wtedy, gdy zmierzono coś (liczba plików osi > 0). Brak pomiaru to kod 2, nie zielone.

## Lista pytań (jedna, na końcu)

```
PYTANIA DO WŁAŚCICIELA (CR <zakres>)
Q1. <jedna linia>  | rekomendacja: <opcja> (<powód w 6 słowach>) | alternatywa: <opcja>
Q2. …
```

Pytania tylko z granicy: pieniądze, zgoda/prawo, strategia produktu, widoczny tekst/UI, usuwanie danych. Każde z rekomendacją. Właściciel odpowiada raz.

## Wzór opisu PR

```
## Co
<zakres, jedno zdanie>

## Znaleziska
<tabela zamknięcia>

## Testy
<osie: liczby; złączony stan: wynik; dowody czerwieni: lista test -> wynik>

## Pytania
<lista Q1..Qn albo "brak">
```

PR otwierasz jako **szkic**; „gotowy" dopiero po zielonym wyniku na SHA głowy. Jeden PR = jeden temat = kilka czytelnych commitów, nie jeden wielki i nie kilka osobnych PR-ów. PR z VPS scala właściciel.
