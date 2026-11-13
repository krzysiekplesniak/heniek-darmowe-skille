# Procedura — kroki 1–4 (mechaniczne)

⛔ **Kroki mechaniczne wykonuje SKRYPT albo git, nie model.** Każdy krok zaczyna się od polecenia. Uruchom je, przeczytaj wynik, dalej działaj na jego liczbach. Agenta (recenzenta, poprawiacza) wołasz tylko dla plików albo zakresów, które wskazał pomiar, albo gdy pomiar się nie udał. Liczenie zakresu, dat przeglądu czy „co już było recenzowane" ręcznie, tokenami, jest błędem procesu.

Skrypt zakresów to `scripts/cr-zakresy.mjs` (menu i pokrycie). Polecenia git poniżej są jego ręcznym odpowiednikiem, gdy skryptu nie ma. Kod 2 skryptu oznacza złą flagę, błędną konfigurację albo nieczytelny rejestr: napraw rejestr albo polecenie, nie licz zakresu „na oko".

## Krok 1 — pomiar okna

⚠️ **Najpierw `git fetch origin`.** Bez tego gałęzie wypchnięte przez inne wątki nie istnieją w lokalnym widoku i po cichu znikają z propozycji.

```bash
git fetch origin
git for-each-ref --sort=-committerdate --format='%(refname:short) %(committerdate:short)' refs/remotes/origin
```

Skrypt okna: `node <skill>/scripts/cr-zakresy.mjs --dni=<N>` (domyślnie 1 = dzisiaj) albo `--od=RRRR-MM-DD --do=RRRR-MM-DD`.

Co liczysz (lub co liczy skrypt):
- **oś gałęzi** = co gałąź **dokłada** ponad gałąź bazową (`git log <baza>..<galaz>`, bazy z `cr.baza_galezi`). Praca już scalona zostaje widoczna na osiach epik i obszar;
- **status** = najnowszy wpis w REJESTR-CR (`cr.rejestr_cr`) dla tego zakresu;
- **kolejność** = `ryzyko × nieosiągalność`.

## Krok 1b — pokrycie: co w ogóle było recenzowane

Skrypt: `node <skill>/scripts/cr-zakresy.mjs --pokrycie --status=NIGDY,NIEAKTUALNY` (tabela plików do recenzji; ręczny odpowiednik poniżej). Uruchom, zanim zaproponujesz zakres z osi ryzyka, przed rotacyjnym przeglądem ścieżki krytycznej i zawsze wtedy, gdy ktoś pyta, kiedy te pliki były ostatnio recenzowane:

```bash
git log -1 --format=%cs -- <plik>        # ostatnia zmiana pliku
```

Każdy plik dostaje status: **NIGDY** (brak wpisu przeglądu), **NIEAKTUALNY** (zmieniony po ostatnim przeglądzie), **AKTUALNY** (przegląd po ostatniej zmianie). Recenzent dostaje **tylko** pliki NIGDY i NIEAKTUALNY. Testy nie wchodzą do pokrycia.

Pliki, których nie da się wyprowadzić z wpisów rejestru (SHA scalenia, gałąź nieistniejąca, fala bez daty), **nie liczą się jako recenzja**. Żeby wpis się liczył, zapisz gałąź, SHA commita nie-merge, zakres `a..b` albo obszar katalogu.

## Krok 2 — podaj MENU, nie analizę

Pokaż listę tak, jak wyszła: numer, klucz, znaczniki, jedna linia liczb. **Maksimum jedno zdanie komentarza od siebie** — rekomendacja, od czego zacząłbyś i dlaczego, w kategoriach ryzyka.

⛔ Nie streszczaj zawartości zmian. Właściciel prosi o menu, nie o analizę.

## Krok 3 — wybór i zlecenie

Właściciel odpowiada numerami. Dla każdego wybranego zakresu policz bazę i HEAD:

| Typ zakresu | Baza → HEAD |
|---|---|
| gałąź | `origin/<baza>...origin/<galaz>` |
| epik | najstarszy commit rodziny → najnowszy |
| obszar | `origin/<baza>...<ref>` z ograniczeniem ścieżek do katalogów obszaru |

Listę plików dla recenzenta bierz z pomiaru, nie z gołego `git diff` czytanego przez model:

```bash
git diff --name-only <baza>...<glowa>
```

Potem uruchamiasz osobnego recenzenta i osobnego poprawiacza. **Jeden agent na jeden zakres**, nigdy jeden na trzy: recenzent z trzema zakresami rozlewa uwagę i wraca z listą stylistyczną.

## Krok 3b — CR integracyjny: zbiór plików

Ten krok obowiązuje, gdy recenzowanym zakresem jest **wydanie albo złączenie kilku PR-ów**, a nie pojedyncza gałąź. Wtedy pytanie „które pliki wziąć" ma inną odpowiedź niż zwykle.

### Metoda bazowa — co złączenie dokłada

```bash
git diff --name-only origin/<baza>...HEAD
git diff --name-only origin/<baza>...HEAD | grep -E '^(<katalogi_zrodel z konfiguracji>)' | grep -v '\.test\.'
```

**Trzy kropki, nigdy dwie.** Trzy liczą od punktu rozejścia bazy, czyli „co to wydanie dokłada". Dwie wciągnęłyby też to, co w międzyczasie doszło na samą bazę.

### ⛔ Dlaczego sama ta metoda NIE WYSTARCZA

Defekt złączenia bardzo często siedzi w pliku, **którego nikt nie zmienił**. Plik zmieniony łamie kontrakt; pęka ktoś inny — konsument leżący poza diffem, więc poza listą kandydatów.

Przykład z praktyki: jeden epik dodał do kontraktu danych wymagane pole. Skutki nie były widoczne z diffu: dwie atrapy w testach z innych gałęzi przestały się kompilować (typy na każdej gałęzi osobno przechodziły, na złączeniu nie), a warstwa odczytu danych rzutowała rekordy bez walidacji. Pomiar na danych produkcyjnych pokazał, że wiersze zapisane wcześniej nie mają tego klucza — czyli błąd dla każdego powracającego użytkownika. Pierwsza poprawka naprawiła typy i wyglądała na domknięcie. Druga to ta sama zmiana zderzona z danymi zapisanymi wcześniej.

### Zbiór właściwy = ZMIENIONE + KONSUMENCI + DANE

| człon | jak wyznaczyć | czego szuka |
|---|---|---|
| **1. zmienione** | `git diff --name-only <baza>...HEAD` | co złączenie dokłada wprost |
| **2. konsumenci** | z plików z (1) wyciągnij eksportowane symbole, potem `grep -rn "<symbol>" <katalogi_zrodel z konfiguracji>` | kto pęka, choć go nie tknięto |
| **3. dane** | dla każdego zmienionego **kontraktu**: czy istnieje migracja albo wartość domyślna dla rekordów sprzed zmiany | rozjazd kod ↔ dane zapisane wcześniej |

Człon (3) jest obowiązkowy, gdy diff dotyka kontraktów danych (typy wspólne, schematy, modele). Zmiana kontraktu bez migracji jest **domyślnie podejrzana** — pole wymagane, którego stare wiersze nie mają. Pytanie do zadania brzmi zawsze: *„czym to pole jest dla rekordu zapisanego wczoraj?"*. Odpowiedź „`null`" jest dobra tylko wtedy, gdy `null` faktycznie tam siedzi, a nie gdy klucza nie ma wcale.

### Weryfikacja członu (3) — pomiarem, nie lekturą

Liczbę dotkniętych wierszy sprawdza się **odczytem z danych** (tylko odczyt, na kopii albo przez narzędzie odczytu), nie szacunkiem. Dopóki nie ma tej liczby, znalezisko jest **hipotezą**. Po niej jest blokerem albo teorią — i jedno zapytanie rozstrzyga, które.

### Podział zakresu między recenzentów

Jeden recenzent na oś, nigdy jeden na całość. Osie sprawdzone w praktyce: bezpieczeństwo i dostęp · kontrakty i silnik · UI jednego ekranu. Recenzent, który nic nie znalazł, to normalny rozkład, nie porażka.

## Krok 4 — zapis do rejestru

Dopisz wiersz do REJESTR-CR (`cr.rejestr_cr` z `.claude/projekt-heniek.json`). **Kolumna z zakresem musi zawierać dokładnie ten klucz, który wypisał pomiar.** Dopasowanie idzie po całym tokenie klucza (`fix/x` nie trafia w `fix/x-2`). Klucz zapisany inaczej nie zostanie znaleziony i zakres wróci jako nierecenzowany.

Żeby wiersz liczył się w pokryciu, kolumna zakresu albo kolumna poprawek musi zawierać coś, z czego da się wyprowadzić pliki: nazwę gałęzi, SHA commita nie-merge, zakres `a..b` albo obszar katalogu. Sama nazwa osi albo SHA scalenia to przegląd osi bez listy plików. W sekcji fali wpisuj ścieżki plików w backtickach i SHA poprawek.

Sprawdzenie po wpisie: `node <skill>/scripts/cr-zakresy.mjs --pokrycie --zakres=<baza>...<glowa>` — pliki fali powinny mieć status AKTUALNY. Brak wiersza `Fala <id>` w REJESTR-CR blokuje bramkę (kod 1).

Zakres świadomie odłożony trafia do sekcji „zaproponowane, jeszcze nie zrecenzowane" z powodem i warunkiem powrotu. Zwykłe „nie zrobione" nie wymaga wpisu — wynika z braku wiersza.
