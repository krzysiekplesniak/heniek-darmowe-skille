# Oś = ścieżka klienta, którą przechodzi zmieniony kod

Plik nie żyje w swoim katalogu. Żyje na jakiejś ścieżce: zakupu, płatności, zamówienia, logowania, odzyskania dostępu. Code review po osi to recenzja **integracyjna**: od wejścia klienta do skutku, a nie "kod w oderwaniu".

## Reguły

| reguła | treść |
|---|---|
| liczba osi = liczba ścieżek, które diff faktycznie dotyka | zwykle 1, rzadko 2-3. Nie dokładasz osi "dla pewności" i nie dzielisz jednej ścieżki na "API / UI / testy". Kilku recenzentów-perspektyw na tym samym diffie zgłasza te same defekty kilka razy |
| 1 agent = 1 oś | czyta zmienione pliki i ich **konsumentów** na tej ścieżce; przechodzi ją od wejścia do skutku: styki, stany błędu, dane zapisane przed zmianą |
| test po osi, zawsze | recenzent uruchamia testy osi z pliku projektu (pole `testy` ścieżki). Brak testu = znalezisko LUKA TESTOWA, nie powód do pominięcia |
| pliki poza ścieżkami | nie są osią; sprawdza je skrypt (typy, testy, build) albo ten sam recenzent jako dodatek |
| diff dotyka więcej niż 3 ścieżek | limit 3 dotyczy agentów na falę, nie liczby osi: pierwsza fala bierze 3 ścieżki o najwyższej wadze (pieniądze, tożsamość, dostęp najpierw), pozostałe dostają drugą falę recenzentów w tej samej rundzie. `osie.mjs --max` dzieli ścieżki na fale, nie wycina ich. Pominąć ścieżkę wolno tylko z jawnym powodem |
| tabela pokrycia ścieżek | obowiązkowa w planie fali i w raporcie: każda ścieżka z diffu = `zrecenzowana (fala k)` albo `pominięta: <powód>`; brak wiersza = błąd planu |

Jeśli lista agentów ma więcej wierszy niż dotkniętych ścieżek, to błąd planu: popraw przed startem.

## Złączenie kilku PR-ów: ZMIENIONE + KONSUMENCI + DANE

Gdy recenzowanym zakresem jest wydanie albo złączenie kilku gałęzi, sam `git diff` nie wystarcza. Defekt złączenia bardzo często siedzi w pliku, **którego nikt nie zmienił**: plik zmieniony łamie kontrakt, pęka konsument spoza diffu.

| człon | jak wyznaczyć | czego szuka |
|---|---|---|
| 1. zmienione | `git diff --name-only <baza>...HEAD` | co złączenie dokłada wprost |
| 2. konsumenci | z plików z (1) wyciągnij eksportowane symbole, potem `git grep -n "<symbol>"` | kto pęka, choć go nie tknięto |
| 3. dane | dla każdego zmienionego **kontraktu** (typu, schematu, formatu zapisu): czy istnieje migracja albo wartość domyślna dla rekordów sprzed zmiany | rozjazd kodu z danymi zapisanymi wcześniej |

Przykład klasy (ogólny): nowe **wymagane** pole w typie preferencji użytkownika. Typy się kompilują, testy są zielone, bo wszystkie atrapy powstały po zmianie. A w bazie tysiące starych rekordów nie mają tego klucza i każdy powracający użytkownik dostaje błąd 500. Pytanie do członu 3 brzmi zawsze: *czym to pole jest dla rekordu zapisanego wczoraj?* "null" jest dobrą odpowiedzią tylko wtedy, gdy null faktycznie tam siedzi, a nie gdy klucza nie ma wcale.

Liczbę dotkniętych rekordów sprawdzasz **odczytem** (zapytanie tylko do odczytu, za zgodą użytkownika na dostęp do bazy), nie szacunkiem. Do tej liczby znalezisko jest hipotezą.

## Soczewki: kod już scalony, bez diffu

Gdy PR jest scalony, pytanie "czy ten PR jest poprawny" przestaje mieć odbiorcę. Liczy się stan, nie wkład. Wtedy zamiast recenzji per PR: audyt soczewkami ryzyka. Jeden agent na jedną soczewkę, nigdy na dwie.

| soczewka | co obejmuje | czego szukać |
|---|---|---|
| PIENIĄDZE | checkout, webhook, uprawnienia, zamówienia, kupony | zapłacił i nie dostał; dostał i nie zapłacił; obejście parametrem żądania |
| TOŻSAMOŚĆ I DOSTĘP | sesja, link logowania, tokeny, panel, middleware | wejście w cudzą tożsamość; podrobienie albo przedłużenie linku; kolejność reguł |
| SILNIK I DANE | logika domeny, kontrakty, migracje | kontrakt kontra dane zapisane wcześniej; ciche gubienie; dwie ścieżki liczące to samo inaczej |
| DANE KLIENTA | panel wewnętrzny, logi, integracje wychodzące | dane osobowe jawnym tekstem; sekret zapisany jako wartość; endpoint kosztowy bez limitu |
| UI | ekrany klienta, komponenty, dostępność | cel dotyku 44x44, kontrast 4,5:1, szerokość 375 px, martwe okablowanie |

Karmisz agenta **klasami defektów zmierzonymi w tym repo** ("sprawdź, czy da się zmienić zakres dostępu parametrem żądania: to już raz się zdarzyło"), nie ogólnikiem ("sprawdź bezpieczeństwo"). Soczewki nie zastępują recenzji **otwartych** PR-ów przed scaleniem.
