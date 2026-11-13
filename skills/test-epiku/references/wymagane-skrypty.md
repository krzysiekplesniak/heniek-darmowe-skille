# Wymagane skrypty, konfiguracja i format planu

Rdzeń (`SKILL.md`) nie zna nazw projektu. Zakres, pomiar i bramkę liczą skrypty z katalogu `scripts` skilla, a dane projektu biorą z pliku konfiguracji. Ten plik opisuje to, co kod faktycznie czyta i zwraca (odczyt kodu z 03.11.2026; po zmianach uruchomiono tylko testy celowane tych skryptów, bez pełnej suity).

**Zasada fail-closed.** Brak skryptu, mapy albo konfiguracji = jawny STOP z raportem: co brakuje, co przez to jest NIESPRAWDZONE, jakie pytanie z rekomendacją. Kod wyjścia 2 znaczy „nic nie policzono”, nie „zero luk”. Kod 0 z niepustym `niesprawdzone` to wynik częściowy.

## 1. Skrypty i ich kontrakt

Wszystkie skrypty piszą JSON na stdout (`krok`, `kod`, `wynik`, `niesprawdzone`), oprócz `bramka-testow-fali.mjs` (własny format z polem `naruszenia`). Nic nie zapisują poza jawnie podanym plikiem (`--zapisz` pokrycia).

| Skrypt | Rola | Flagi | Kody |
|---|---|---|---|
| `mapa-testow.mjs` | zmienione pliki -> testy jednostkowe, ścieżki krytyczne, komendy, smoke | dokładnie jedno: `--baza=<ref>` (porównanie z drzewem roboczym), `--pliki=a,b`, `--stdin`; `--poziom=task\|fala\|wydanie` (domyślnie `fala`); `--bez-smoke`; `--sucho`; `--config=<plik>` | 0 wyliczono; 1 zmieniony plik ścieżki krytycznej bez testu jednostkowego obok ani w grafie importów; 2 błąd użycia, zła konfiguracja, zero plików testów, pusta lista |
| `pokrycie-testow.mjs` | osiągalność każdego pliku kodu z testów: E2E, PRZEKLIK, JEDNOSTKOWE, ZADEN | `--config`, `--sciezka=P1,P4`, `--status=E2E\|PRZEKLIK\|JEDNOSTKOWE\|ZADEN\|RAZEM`, `--zapisz=<plik.md>` (tylko jawna ścieżka), `--sucho` | 0 zmierzono bez naruszeń; 1 plik ścieżki krytycznej bez żadnego testu; 2 brak pomiaru lub zła konfiguracja |
| `detektor-testow.mjs` | edycja i osłabianie istniejących testów w `baza...glowa` | `--baza=<ref>` (wymagane), `--glowa=<ref>` (domyślnie HEAD), `--repo=<dir>`, `--wyjatki=<plik>` | 0 czysto; 1 trafienia (plik:linia, typ); 2 zły ref albo nie repozytorium git |
| `lint-scenariuszy.mjs` | kontrola nowych `.feature` (jedno zachowanie, poniżej 10 kroków, Wtedy sprawdzalne, bez selektorów, czekań i adresów API) | `--baza=<ref>`, `--glowa=<ref>` (domyślnie HEAD), `--pliki=a.feature,b.feature`, `--repo=<dir>`, `--parser=<gherkin.mjs>` | 0 czysto; 1 naruszenie (plik:linia); 2 brak parsera, brak źródła listy albo zero plików `.feature` w zakresie (wynik `BRAK_PLIKOW_FEATURE`) |
| `bramka-testow-fali.mjs` | zamknięcie testów fali na podstawie planu | `--plan=<plik.json>` (wymagane), `--config=<plik>` (domyślnie `<repo>/.claude/projekt-heniek.json`), `--repo=<dir>` | 0 ZAMKNIETE; 1 NARUSZENIE; 2 BRAK POMIARU |
| `walidator-metek.mjs` | metki stanu scenariuszy `.feature` względem bazy (reguły a–e, sekcja 6) | `--baza=<ref>` (wymagane), `--glowa=<ref>` (domyślnie HEAD), `--repo=<dir>`, `--parser=<gherkin.mjs>`, `--dowod-testu=<sha-lub-plik>` (powtarzalna lub po przecinku), `--wejscie=<json\|->`, `--sucho` | 0 zielono; 1 naruszenie (plik:linia); 4 decyzja właściciela (obniżenie stanu, usunięcie metki lub scenariusza ze stanem); 2 brak pomiaru. Priorytet 1 > 4 > 2 > 0 |
| `scripts/lib/gherkin.mjs` (lokalna kopia paczki `przekliki-ogorkowe`) | parser `.feature` dla lintu i walidatora metek; bajt w bajt jak źródło, pilnuje `parser-parytet.test.mjs` | `<katalog> [--metki=@jest,@na-galezi] [--json]` | 0 poprawne; 1 błąd parsowania; 2 brak katalogu albo zero plików `.feature` |

Uwagi do kontraktu:
- `mapa-testow.mjs --baza=<ref>` wywołuje `git diff --name-only <ref>` (drzewo robocze kontra ref). Dla zakresu gałęzi zawsze podawaj listę przez `--stdin` z `git diff --name-only --no-renames <baza>...<glowa>`.
- `mapa-testow.mjs` i `pokrycie-testow.mjs` zwracają kod 0 także wtedy, gdy `niesprawdzone` jest niepuste (np. oś E2E nieliczona, brak testów jednostkowych dla zmian kodu, zmieniony spec przeglądarkowy). Taka pozycja jest NIESPRAWDZONE.
- `detektor-testow.mjs` nie sprawdza, czy w zakresie są jakiekolwiek pliki testowe (`pliki_testowe` w JSON). Kod 0 znaczy „nie wykryto osłabienia”, nie „testy są”.
- `lint-scenariuszy.mjs` przy zerze plików `.feature` w zakresie zwraca kod 2 i wynik `BRAK_PLIKOW_FEATURE` (decyzja właściciela: kontrola nie zaszła, więc nie zielono).
- Lint i walidator metek domyślnie używają `scripts/lib/gherkin.mjs` (względem katalogu skryptu). Brak pliku = kod 2; inny parser podasz przez `--parser=`. Kopia musi być bajt w bajt taka jak źródło w paczce `przekliki-ogorkowe` (pluginu `heniek-start-darmowe`); test `parser-parytet.test.mjs` sprawdza to, gdy paczka leży obok pluginu, a bez niej jest pominięty z podanym powodem.
- Parser `gherkin.mjs`: blok `Reguła:`/`Rule:` jest notatką do końca pliku (raport `NOTATKA (nie wykonywana)`). Scenariusz albo krok w środku notatki to błąd parsowania (kod 1).

## 2. Konfiguracja: `.claude/projekt-heniek.json`

Skrypty czytają ten plik z katalogu roboczego (domyślnie), chyba że podano `--config=<plik>`. Kod 2 przy braku pliku, braku obiektu `testy` albo braku wymaganego klucza.

Klucze czytane przez skrypty:

| Klucz | Czyta | Znaczenie | Wymagany |
|---|---|---|---|
| `sciezki` (top-level) | mapa, pokrycie | lista `{id, nazwa, kategoria, pliki[], pliki_testowe[], testy[]}`; `id` i niepusta lista `pliki` wymagane | tak (albo `testy.mapa_sciezek`) |
| `testy.mapa_sciezek` | mapa, pokrycie | ścieżka do pliku JSON, który zastępuje `sciezki` | nie |
| `testy.katalogi_kodu` | mapa, pokrycie | prefiksy katalogów kodu produktu, np. `["src/"]` | tak |
| `testy.wzorzec_testu` | mapa, pokrycie | regex (tekst) pliku testu jednostkowego | tak |
| `testy.katalog_tras` | pokrycie | katalog tras aplikacji, do wskazania adresów E2E i PRZEKLIK | tak dla pokrycia |
| `testy.katalogi_e2e`, `testy.wzorzec_specu` | pokrycie, mapa | prefiksy katalogów specow przeglądarkowych; domyślny wzorzec `\.spec\.(ts\|tsx\|js\|jsx\|mjs\|cjs)$` | nie (bez nich oś E2E nieliczona) |
| `testy.katalog_scenariuszy`, `testy.metki_klikane`, `testy.katalog_krokow` | pokrycie | katalog `.feature`, metki liczone do PRZEKLIK (pusta lista = każdy scenariusz), katalog definicji kroków | nie (bez nich oś PRZEKLIK nieliczona) |
| `testy.alias` | pokrycie, mapa | mapa prefiksów importu, domyślnie `{"@/": "src/"}` | nie |
| `testy.krytyczne_kategorie` | mapa, pokrycie | kategorie ścieżek, których plik bez testu = naruszenie (kod 1). Domyślnie `["pieniądze", "tożsamość i dostęp"]`: ustaw jawnie | nie, ale ustaw |
| `testy.wyjatki_plik` | pokrycie | JSON `[{plik, powod}]` wyjęty z mianownika (plik musi istnieć wśród plików kodu) | nie |
| `testy.smoke` | mapa | id ścieżek dokładanych na poziomie `fala` | nie (pusta = niesprawdzone) |
| `testy.komenda_jednostkowych` | mapa | szablon z `{pliki}`; domyślnie `node --test {pliki}` | nie |
| `testy.zapadka` | bramka | lista `{klucz, kierunek}`, `kierunek` = `nie_wzrasta` albo `nie_spada` | tak (brak = kod 2) |
| `testy.warstwy_wymagane` | bramka | warstwy, które muszą mieć przebieg, nawet bez luk | nie |

Klucze spoza skryptów (komendy warstw, komenda weryfikacji, bramka CR, rejestry testów, słownik metek, adres stagingu, modele per rola) czyta ORK. Nazw nie zgadujesz: brak = STOP albo NIESPRAWDZONE dla danej warstwy.

Przykład kształtu (wartości fikcyjne):

```json
{
  "sciezki": [
    {"id": "P1", "nazwa": "zakup", "kategoria": "pieniądze", "pliki": ["src/checkout/**"], "pliki_testowe": ["przyklad/checkout/**"], "testy": ["npm run test:checkout"]}
  ],
  "testy": {
    "katalogi_kodu": ["src/"],
    "wzorzec_testu": "\\.test\\.[cm]?[jt]sx?$",
    "katalog_tras": "src/app/",
    "katalogi_e2e": ["przyklad/e2e/"],
    "katalog_scenariuszy": "przyklad/historie/",
    "metki_klikane": ["@jest", "@na-galezi"],
    "krytyczne_kategorie": ["pieniądze", "tożsamość i dostęp"],
    "smoke": ["P1"],
    "zapadka": [{"klucz": "nieprzetestowane_pliki", "kierunek": "nie_wzrasta"}],
    "warstwy_wymagane": ["jednostkowa"]
  }
}
```

## 3. Format planu dla bramki

`bramka-testow-fali.mjs --plan=<plik.json>`. Plan składa ORK z wyników skryptów i z tabeli luk. Brak skryptu, który składa plan.

```json
{
  "fala": "E12",
  "pytania": ["Q1"],
  "luki": [
    {"id": "L-1", "warstwa": "jednostkowa", "sciezka": "P1", "plik_testu": "przyklad/checkout/x.test.ts", "stan": "POKRYTE", "sha": "abc1234", "dowod": "komenda, kod, liczba uruchomionych", "autor_testu": "zlecenie-B", "autor_kodu": "zlecenie-A"},
    {"id": "L-2", "warstwa": "jednostkowa", "sciezka": "P2", "plik_testu": "przyklad/x/y.test.ts", "stan": "ISTNIEJE", "sha": "def5678", "dowod": "test poprawiacza, klasa luki z CR"},
    {"id": "L-3", "warstwa": "jednostkowa", "sciezka": "P3", "stan": "ODLOZONE Q1", "powod": "wymaga zmiany kodu produktu"}
  ],
  "przebiegi": [
    {"warstwa": "jednostkowa", "komenda": "npm run test:unit -- przyklad/checkout/x.test.ts", "kod": 0, "uruchomionych": 14}
  ],
  "pomiar_przed": {"nieprzetestowane_pliki": 12},
  "pomiar_po": {"nieprzetestowane_pliki": 11},
  "wynik_detektora": {"kod": 0, "trafienia": []}
}
```

Reguły bramki:
- `stan` z listy: `POKRYTE`, `ISTNIEJE`, `NIE DOTYCZY` (wymaga `powod`), `ODLOZONE Qn` (Qn musi być w `pytania`). `OCZEKIWANA CZERWIEN` i każdy inny tekst = naruszenie.
- `POKRYTE` i `ISTNIEJE` wymagają `plik_testu` (istniejący w repo) i niepustego `sha`.
- Każda warstwa z luk (oraz z `testy.warstwy_wymagane`) ma przebieg. Brak przebiegu, `uruchomionych` 0 albo brak kodu = NIESPRAWDZONE (kod 2). Kod różny od 0 = naruszenie.
- `wynik_detektora`: kod 1 = naruszenie `EDYCJA TESTU` (lista trafień wymagana); kod 2 albo brak = NIESPRAWDZONE.
- Zapadka: każdy `klucz` z `testy.zapadka` porównywany z `pomiar_przed` i `pomiar_po`; liczba albo obiekt liczb (wtedy porównanie po każdym polu). Brak pomiaru = NIESPRAWDZONE.

Czego bramka NIE sprawdza (w kodzie, nie w projekcie), więc ORK sprawdza to sam i pisze w raporcie:
- że `sha` jest przodkiem głowy (pole tylko niepuste);
- że commity luk dotykają wyłącznie plików testowych (kontrola zakresu commitów; ORK sprawdza `git show --stat` każdego SHA);
- wynik lintu scenariuszy (nie wchodzi do planu, ORK wpisuje go do raportu);
- dwie kontrole negatywne i 3x solo (dowód w raporcie, nie w planie);
- że `autor_testu` różni się od `autor_kodu` (pola są opcjonalne i nie są porównywane);
- miarę tripletu i wpis rejestru testów.

## 4. Zakres CR (wejście etapu A)

Skrypt bramki CR i zakresów CR (klucz `bramka_cr`) nie jest częścią tego katalogu. Stan CR czytaj z tabeli fali w rejestrze znalezisk. Brak bramki CR = `CR: NIESPRAWDZONE` w raporcie.

## 5. Gdzie leżą skrypty (stan odczytu 03.11.2026)

Skrypty `mapa-testow`, `pokrycie-testow`, `detektor-testow`, `lint-scenariuszy`, `walidator-metek`, `bramka-testow-fali` leżą w katalogu `scripts` tego skilla (`<skill>/scripts`, `<skill>` = katalog bazowy skilla), obok testów `*.test.mjs`, gdy są w kopii. Parser jest lokalną kopią w `scripts/lib/gherkin.mjs`; źródłem jest skill `przekliki-ogorkowe` (jego parser `gherkin.mjs`).

## 6. Walidator metek (`walidator-metek.mjs`)

Zakres: pliki `.feature` zmienione w `baza...glowa` (porównanie z merge-base). Scenariusz łączony po nazwie (zmiana nazwy = usunięcie plus nowy). Stdout: JSON `{krok, kod, wynik, niesprawdzone, pliki_feature, scenariusze, naruszenia[], decyzje[]}`. Skrypt nic nie zapisuje; `--sucho` tylko zaznacza tryb w raporcie.

Reguły (kody jak w tabeli sekcji 1):
- (a) wejście w `@jest` albo `@na-galezi` (z `@planowane`, z innego stanu, jako nowy scenariusz) wymaga ważnego dowodu: istniejący commit (sha) albo istniejący plik. Bez dowodu = 1. Treść dowodu nie jest czytana.
- (b) obniżenie stanu (ranga: `@jest` 3 > `@na-galezi` 2 > pozostałe stany 1 > brak 0), usunięcie metki stanu i usunięcie scenariusza z metką stanu = 4 (decyzja właściciela).
- (c) nowy scenariusz bez metki stanu = 1.
- (d) nowa metka spoza listy (metki stanu, `@podroz`, `@rola:<coś>`) = 1; metka stanu na poziomie `Funkcja:` = 1.
- (e) brak gita, zły ref, brak bazy, brak parsera, zła flaga, zepsute wejście JSON = 2.

Interpretacje do potwierdzenia przez właściciela: `@jest` -> `@na-galezi` traktowane jako obniżenie (specyfikacja mówi tylko o `@jest` -> `@planowane`); awans `@na-galezi` -> `@jest` wymaga dowodu jak `@planowane` -> `@jest`; usunięcie scenariusza z metką stanu (także `@planowane`) = 4; metki spoza listy w scenariuszach, które się nie zmieniły, nie są zgłaszane.

Niesprawdzone: treść dowodu (sprawdzane jest tylko istnienie); czy dowód dotyczy tego scenariusza (skrypt ich nie łączy); metki na poziomie funkcji nie zmieniają stanu scenariuszy; czy scenariusz z `@jest` ma kroki, które przechodzą w przeklikach.
