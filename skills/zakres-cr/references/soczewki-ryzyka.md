# Soczewki ryzyka — dla kodu JUŻ SCALONEGO

Gdy PR jest scalony, recenzja jego samego przestaje mieć sens jako pierwsza linia obrony. Pytanie „czy ten PR jest poprawny" przestało być pytaniem, na które ktokolwiek zareaguje. Liczy się **stan**, nie wkład. Właściwe pytanie brzmi: „co się stanie, jeśli akurat TO zawiedzie" — i ono działa na kodzie, którego nikt już nie wnosi.

Testy całościowe kodu scalonego (cały kod, nie pojedynczy PR) robi się soczewkami. Soczewka to powierzchnia odpowiedzialności, nie katalog.

| soczewka | co obejmuje | czego szukać |
|---|---|---|
| **PIENIĄDZE** | płatności, webhooki, uprawnienia, zamówienia, kupony | zapłacił i nie dostał; dostał i nie zapłacił; obejście przez parametr żądania |
| **TOŻSAMOŚĆ I DOSTĘP** | sesje, linki logowania, tokeny, panel, pośrednicy | wejście w cudzą tożsamość; podrobienie albo przedłużenie linku; kolejność reguł |
| **SILNIK I DANE** | kompozycja planu, kwalifikacja, kontrakty danych, kompilacja treści | kontrakt kontra dane zapisane WCZEŚNIEJ; ciche gubienie danych; rozjazd dwóch ścieżek |
| **PANEL I DANE KLIENTA** | część administracyjna, obserwowalność, alarmy, integracje wychodzące | dane osobowe w postaci jawnej; sekret zapisywany jako wartość; endpoint kosztowy bez limitu |
| **UI** | ekrany klienta, komponenty, dostępność | próg dotyku, kontrast, układ na małym ekranie, martwe połączenia, spójność wzorca |
| **POZYSKIWANIE TREŚCI** | pobieranie treści i zdjęć, prawa, kompilacja | koszt bez limitu; skrypt wychodzący z zerem bez pracy; bramka mierząca nie to, co deklaruje |

## Jak to prowadzić

**Jeden agent na jedną soczewkę, nigdy jeden na dwie.** Recenzent z dwiema rozlewa uwagę i wraca z listą stylistyczną.

**Karm agenta KLASAMI defektów zmierzonymi w tym repo**, nie ogólnikami. „Sprawdź bezpieczeństwo" daje raport o niczym; „sprawdź, czy da się zmienić zakres dostępu parametrem żądania — to się już zdarzyło i przeszło przez zestaw testów" daje znalezisko.

**Wpis do rejestru w kolumnie zakresu to nazwa soczewki**, nie gałęzi.

## ⚠️ Zero znalezisk jest podejrzane, dopóki nie sprawdzisz historii

Soczewka zamknięta bez znalezisk to podejrzany wynik, dopóki nie wiadomo, kiedy te pliki były ostatnio przeglądane. „Czysto" bez sprawdzenia historii to nie dowód — to może być przegląd tego, co już naprawiono dzień wcześniej.

Zanim wpiszesz `czysto` dla soczewki z zerem znalezisk, sprawdź ostatnią zmianę i ostatni przegląd każdego pliku soczewki (`git log -1 --format=%cs -- <plik>` oraz wpisy rejestru). Dla plików budzących wątpliwość dołóż `git log -3 -- <plik>`. Trzy odczyty:

- plik dotykany w ostatnich godzinach przez TĘ SAMĄ falę przeglądu → zero znalezisk jest oczekiwane, nie dowodowe (recenzent patrzył na świeżo naprawiony kod);
- plik ma otwarte znalezisko z poprzedniego przeglądu → sprawdź WPROST w kodzie, czy ta konkretna poprawka tam jest (nie ufaj samej dacie commita, sprawdź treść), zanim uznasz soczewkę za czystą. Uwaga: kod często używa nazwanej stałej, a nie dosłownego tekstu z opisu problemu, więc grep po dosłownym tekście bywa mylący;
- plik nie był tykany od dawna i nie ma otwartego wątku → „czysto" jest wtedy wiarygodne.

## Czego soczewki NIE zastępują

Przeglądu **otwartych** PR-ów przed scaleniem. Te dalej idą per PR, bo tam pytanie „czy to wpuścić" jest żywe. Soczewka mówi o tym, co już jest w środku.
