---
name: zakres-cr
description: Use for ANY code review request — both when the owner gives a scope (PR, branch, epic, commits, files, risk axis — "zrób CR osi X", "CR PR-a 66", "przetestuj gałąź") and when they have NOT said what to review ("chcę zrobić CR", "zróbmy CR", "co do recenzji?"). Runs scope intake, read-only reviewers per axis, triage into canonical finding IDs, fixers in the same wave, integration, a scripted closing gate, and ends with exactly ONE PR plus ONE list of decision questions with recommendations. Without a scope it first produces a numbered menu of candidate scopes from a day or range of days. Never prints diffs. An "axis" is ONE business/customer path the changed code runs through (purchase, payment, order, access recovery, ...), reviewed end to end. Does NOT write e2e or przeklik tests — those belong to test-epiku and przeklik-mieszany (jeśli masz ten skill).
---

# Zakres CR — co poddać recenzji i jak zamknąć falę

Skill dla każdej prośby o code review. Prowadzi recenzję od zakresu do jednego PR i jednej listy pytań. Właściciel nie chce raportu „znaleziska są, poprawki potem" — chce czystego PR i listy decyzji.

Tryby: lokalnie (agenci w oknie orkiestratora) albo na VPS (etap B, `heniek dispatch flow:cr-osi`). Ta sama rura i ta sama koperta (paczka `cr-zakres`).

## Podział: skrypt orkiestruje, model ocenia

- **Skrypty** robią to, co mechaniczne: menu kandydatów, pokrycie plików, bramkę zamknięcia. Krok = polecenie, czytasz wynik, dalej działasz na jego liczbach. Liczenia zakresu „na oko" nie ma.
- **Model** robi osąd: recenzja osi, werdykt, klasa znaleziska, granica „poprawka czy pytanie", opis luki testowej.
- **Agenta** wołasz tylko dla plików albo osi, które wskazał pomiar, albo gdy pomiar się nie udał. Kolejność etapów i bramki pilnuje ORK, nie model.

## RURA — kontrakt wejścia i wyjścia (zawsze)

```
WEJŚCIE:   zakres — PR / gałąź / epik / commity / pliki / oś
   ↓ recenzent (B)  → każde znalezisko od razu do rejestru, z kanonicznym ID
   ↓ poprawiacz (D) → wszystko, co nie wymaga decyzji właściciela
   ↓ integracja (E) → jedna gałąź, konflikty, testy na ZŁĄCZONYM HEAD
WYJŚCIE — dokładnie dwie rzeczy, podane RAZEM, na końcu:
   1. JEDEN PR   — szkic, z tabelą znalezisko → stan → SHA → pliki
   2. JEDNA lista — pytania Q1..Qn, każde z rekomendacją
```

**Słownik stanów znaleziska — jedyny obowiązujący** (ten sam wymaga bramka `cr-bramka-zamkniecia.mjs`):

| stan | znaczenie | wymaganie |
|---|---|---|
| `NAPRAWIONE` | poprawka wdrożona na gałęzi PR | SHA commita, który jest przodkiem głowy |
| `OBALONE` | przesłanka nie potwierdziła się | DOWÓD: komenda i wynik obalający |
| `CZYSTO` | pozycja sprawdzona, bez defektu do naprawy i bez czego obalać (np. oś zrecenzowana bez ustaleń) | opis sprawdzenia w kolumnie „OPIS SPRAWDZENIA” (bramka (g) blokuje pusty) |
| `PYTANIE Qn` | naprawa wymaga decyzji właściciela (granica niżej) | `Qn` istnieje w liście pytań |

Stanów „wisi", „czeka", „POTWIERDZONE", „ODRZUCONE", „NAPRAWIONE W PR" **nie ma**. `CZYSTO` nie służy do ukrycia defektu: znalezisko z defektem nigdy nie jest `CZYSTO`. Wiersz z innym stanem = naruszenie bramki (kod 1).

Granica „poprawka vs pytanie": pytanie tylko wtedy, gdy naprawa zmienia **pieniądze, zgodę/prawo, strategię produktu, widoczny dla klienta tekst/UI albo usuwa dane**. Wszystko inne poprawiacz naprawia bez pytania.

Zakazane: recenzja bez poprawiacza („naprawimy potem"); wpisy do rejestru „na koniec" (wpis powstaje, gdy agent wraca); ciche parkowanie decyzji (decyzji, której nie ma na liście pytań, nie ma); osobne PR-y per poprawka (gałęzie robocze są wewnętrzne, PR jest jeden); pytania rozproszone w trakcie (zbierasz je i zadajesz raz, na wyjściu).

## OŚ = ścieżka integracyjna

Oś to ścieżka biznesowa lub klienta, od wejścia do skutku, nie wymiar, z którego da się spojrzeć na diff. Katalog ścieżek: pole `sciezki` w `.claude/projekt-heniek.json` (patrz „Konfiguracja").

- **Liczba osi = liczba ścieżek, które diff faktycznie dotyka** (zwykle 1, rzadko 2–3). Nie dzielisz jednej ścieżki na „API / UI / testy".
- **1 agent = 1 oś.** Recenzent czyta zmienione pliki i ich konsumentów na ścieżce, od wejścia do skutku (styki, dane zapisane przed zmianą, stany błędu).
- **Test po osi — zawsze.** Recenzent uruchamia celowane testy osi z listy z pomiaru (`mapa-testow.mjs` z `test-epiku`), nie z wyboru agenta. Brak testu dla osi = znalezisko klasy LUKA TESTOWA, nie powód do pominięcia.
- **Pliki poza ścieżką** (dokumenty, konfiguracja, same testy) nie dostają agenta: sprawdza je skrypt (typy, testy jednostkowe) albo ten sam recenzent jako dodatek.
- **Diff dotyka > 3 ścieżek:** pierwsza fala to 3 ścieżki o najwyższej wadze (pieniądze, tożsamość, dostęp najpierw); pozostałe — druga fala w tej samej rundzie. Pominąć ścieżkę wolno tylko z powodem w tabeli pokrycia.
- **Tabela pokrycia ścieżek — obowiązkowa** w etapie A i w raporcie: każda ścieżka dotknięta diffem to `zrecenzowana (fala k, agent)` albo `pominięta: <powód>`. Ścieżka bez wiersza = błąd planu.
- **Projekt bez katalogu ścieżek:** zbuduj go z diffu i tras aplikacji (id, nazwa, waga, globy), zacommituj razem z falą. Osie z pamięci są zakazane.

## Test po osi, luka testowa, granice CR

- CR **nie pisze** testów e2e ani przeklików. Robi dwie rzeczy: uruchamia celowane testy osi z listy z pomiaru, a każdemu znaleziskiem klasy POPRAWKA przypisuje **klasę luki testowej**: `brak testu` · `test kształtu zamiast zachowania` · `test pominięty albo wyłączony` · `test na złej warstwie` · `środowisko lub dane testu inne niż produkcja`.
- Poprawiacz dowodzi naprawy: test (lub komenda) **czerwony na starym kodzie** z wynikiem w kolumnie DOWÓD, plus kontrola negatywna. Trwały test regresji pisze `test-epiku`, którego autor jest inny niż autor poprawki.
- E2 i E3 **nie są etapem CR**. Z CR wychodzi zlecenie dla ORK: lista luk (plik, klasa, ścieżka) oraz flaga „fala dotyka stanu współdzielonego między ekranami". ORK zleca wtedy celowane e2e (`test-epiku`) i po scaleniu fali przeklik mieszany (`przeklik-mieszany`, jeśli masz ten skill; bez niego wpisz do raportu, że przeklik stanu współdzielonego nie został wykonany).

## Limit rund (kontrakt; bramka pilnuje kolumny Rundy)

| runda | kiedy | co |
|---|---|---|
| **1 CR + 1 poprawki** | zawsze, każda fala | recenzja po osiach, poprawiacze, integracja, bramka |
| **przeklik/e2e + poprawki** | po 1 CR + 1 poprawki, gdy linia ma przeklik | poprawki z przeklików w tej samej fali |
| **CR końcowe** (jedno, jeden agent na złączonym HEAD, diff-only od SHA pierwszej rundy) | ZAWSZE po przekliku i poprawkach, niezależnie od osi (decyzja właściciela 10.11, zmienia zasadę z 16.10) | znaleziska z niego: 1 runda poprawek, potem bramka; `pr --gotowy` dopiero po nim |
| **kolejne rundy** | NIGDY z automatu | znalezisko, które by ją wywołało, idzie na listę pytań z rekomendacją |

Job VPS ma `maxRounds` zgodne z 1+1. Licznik rund to opcjonalna kolumna `Rundy` w REJESTR-CR (`| Data | Zakres | Typ | Wynik | Poprawki (SHA) | Kto / model | Rundy |`). CR końcowe wpisz jako `3 (CR końcowe, reguła 10.11)`. Bramka (h) blokuje wartość większą niż 2 bez wpisu wyjątku w tej samej komórce, np. `3 (wyjątek: decyzja właściciela)`. Bez kolumny Rundy ORK pilnuje limitu ręcznie.

## Procedura A–H

| etap | kto | co robi | koniec etapu = |
|---|---|---|---|
| **A. Przyjęcie zakresu** | ORK + skrypt | zakres podany → bierz go; brak → menu (`cr-zakresy.mjs`, patrz niżej). Policz bazę i HEAD. Listę plików bierz z pomiaru (`git diff --name-only <baza>...<glowa>`). Załóż sekcję `## Fala <id>` z plikami i ścieżką każdego pliku | sekcja fali zapisana, tabela pokrycia gotowa |
| **B. Recenzja** | recenzenci read-only, 1 agent = 1 oś, model jawny | zwracają znaleziska ze scenariuszem awarii; dowód z `git show origin/<gałąź>:<plik>`; nie piszą do żadnego worktree | raport w wyniku agenta |
| **C. Triage** | ORK | każde znalezisko dostaje kanoniczne ID z rejestru (nie numer recenzenta) i stan: POPRAWKA / `PYTANIE Qn` / `OBALONE` (z dowodem) / `CZYSTO` | każdy wiersz ma ID i stan |
| **D. Poprawiacze** | 1 agent = 1 klasa defektu, pracuje w katalogu roboczym fali (bez własnej gałęzi) | najpierw weryfikuje przesłankę (może obalić); naprawa; dowód czerwieni na starym kodzie; kontrola negatywna; grep rodzeństwa i konsumentów (klasa defektu, nie jedno miejsce); poprawia pliki w katalogu roboczym i zgłasza listę zmian (pliki, ID znaleziska, dowód); **nie commituje i nie pushuje** | lista zmian; SHA dopiero po commicie koordynatora |
| **E. Integracja** | ORK albo agent integratora | jedna gałąź `cr/<fala>` od bazy; **koordynator (ORK) commituje zmiany poprawiaczy**, po jednym commicie na klasę defektu z ID w treści (agenci nie commitują); **przed scaleniem** `git diff --stat <baza>...<galaz>` — plik spoza klasy = STOP; konflikty; testy na złączonym HEAD | złączony HEAD zielony |
| **F. Bramka zamknięcia** | skrypt `cr-bramka-zamkniecia.mjs` | patrz niżej | kod 0 |
| **E2. e2e celowane (lokalnie)** | ORK zleca (`test-epiku`), CR nie wykonuje | PO F, przed PR: celowane e2e dobrane do plików fali. Fala dotyka pieniędzy → ścieżka zakupu obowiązkowa. Pełnego e2e nie dublujemy | celowane e2e zielone, wynik w opisie PR |
| **E3. Przeklik stanu współdzielonego** | ORK zleca (`przeklik-mieszany`, jeśli masz ten skill), CR nie wykonuje | PO F, gdy fala dotyka stanu współdzielonego między ekranami: przeklik mieszany na złączonym HEAD, przed pushem na staging. Zielone typy, testy i CR to minimum, nie dowód | raport: liczba podróży, naruszenia per niezmiennik |
| **G. Wyjście** | ORK | szkic PR z tabelą; w tej samej wiadomości lista pytań Q1..Qn | 1 link PR + 1 lista |
| **H. Rejestry** | ORK | wiersz w REJESTR-CR (zakres, pliki, data, rundy, luki), sekcja fali zamknięta, worktree `fix/<fala>-*` usunięte | drzewo czyste |

Po F ORK zleca testy (`test-epiku`) i — gdy fala dotyka stanu współdzielonego — `przeklik-mieszany` (jeśli masz ten skill). Wynik idzie do opisu PR; CR ich nie wykonuje.

Format sekcji fali i pełny tekst etapów: `references/rura-i-procedura.md`.

## Co skill robi, a czego nie robi

| Robi | Nie robi |
|---|---|
| zakres podany → od razu etap A; brak zakresu → pyta **wyłącznie o okno czasu** (domyślnie dzisiaj) | nie pyta „co chcesz zrecenzować" |
| prowadzi CR **do końca**: poprawiacze, integracja, bramka, 1 PR + 1 lista pytań | nie oddaje raportu „znaleziska są, poprawki potem" |
| podaje ponumerowane menu kandydatów: gałęzie, epiki, obszary | nie drukuje diffa, nie streszcza zmian linia po linii |
| dopisuje wiersz do rejestru po zamknięciu recenzji | nie ocenia jakości kodu przed recenzją |
| zleca ORK celowane e2e i przeklik po etapie F (E2, E3) | nie pisze e2e ani przeklików, nie uruchamia ich jako etapu CR |

## Skrypty

`<skill>` = katalog bazowy tego skilla („Base directory for this skill”: w pluginie albo `~/.claude/skills/zakres-cr`). Skrypty wołasz z katalogu projektu klienta, ścieżką `<skill>/scripts/...`, nigdy względem bieżącego katalogu.

### Menu i pokrycie — `cr-zakresy.mjs`

```
node <skill>/scripts/cr-zakresy.mjs --dni=<N>                 menu: ostatnie N dni (domyślnie 1 = dzisiaj)
node <skill>/scripts/cr-zakresy.mjs --dzien=RRRR-MM-DD         menu: jeden dzień
node <skill>/scripts/cr-zakresy.mjs --od=RRRR-MM-DD --do=RRRR-MM-DD
node <skill>/scripts/cr-zakresy.mjs --pokrycie [--sciezka=<prefiks albo ID ścieżki>] [--zakres=<baza>...<glowa>] [--status=NIGDY,NIEAKTUALNY] [--json] [--bez-tabeli]
node <skill>/scripts/cr-zakresy.mjs --pokrycie --zapisz=<plik.md> [--sucho]     jedyny zapis skryptu
```

Dodatkowe flagi: `--baza-1=<ref>` i `--baza-2=<ref>` nadpisują pierwszy i drugi ref z `cr.baza_galezi`; `--rejestr-cr=<plik>`, `--rejestr-znalezisk=<plik>`, `--config=<plik>`. Menu nie drukuje diffów. Kod 0 = wynik; kod 2 = błąd użycia, konfiguracji albo nieczytelny rejestr (nic nie uznajesz za wynik).

### Bramka zamknięcia — `cr-bramka-zamkniecia.mjs`

```
node <skill>/scripts/cr-bramka-zamkniecia.mjs --fala=<id> --baza=<ref> --glowa=<ref> [--tabela] [--rejestr=<plik>] [--rejestr-w-repo=<plik>] [--rejestr-cr=<plik>] [--config=<plik>]
```

Wymagane: `--fala`, `--baza`, `--glowa`. `--sucho` jest przyjmowane i nic nie zmienia; bramka niczego nie zapisuje. Sprawdza: (a) stan każdego wiersza jest jednym z czterech; (b) `NAPRAWIONE` ma SHA będący przodkiem głowy; (c) każdy commit nie-merge z `baza..glowa` jest przypisany do wiersza albo do „Commity bez znaleziska" (wyjątek: commit porządkowy zmieniający tylko ślad CR); (d) każde `PYTANIE Qn` ma `Qn` w tabeli pytań; (e) `OBALONE` ma niepusty DOWÓD; (f) REJESTR-CR ma wiersz `Fala <id>` w kolumnie Zakres; (g) `CZYSTO` ma niepusty opis w kolumnie „OPIS SPRAWDZENIA” (pusty albo brak kolumny = naruszenie); (h) limit rund 1+1 w opcjonalnej kolumnie Rundy (patrz wyżej).

Kody: **0** zero naruszeń; **1** naruszenia — wracasz do C/D, nie do właściciela; **2** brak pomiaru: błąd użycia, zły ref, brak albo nieczytelny rejestr znalezisk lub REJESTR-CR, brak sekcji fali, brak tabeli znalezisk, zły config. Kod 2 nigdy nie jest zielonym wynikiem.

## Konfiguracja: `.claude/projekt-heniek.json`

```json
{
  "cr": {
    "rejestr_cr": "<plik REJESTR-CR>",
    "rejestr_znalezisk": "<plik REJESTR-ZNALEZISK>",
    "katalogi_zrodel": ["<katalog kodu>/"],
    "baza_galezi": ["<baza integracyjna>", "<gałąź przed produkcją>"],
    "wyjatki": {
      "nie_kod": ["<globy, które nie są kodem do recenzji>"],
      "ryzyko": [{ "znak": "<etykieta>", "wzor": "<regex>" }],
      "pieniadze_tozsamosc": null
    },
    "obszary_glebokie": []
  },
  "sciezki": [
    { "id": "P1", "nazwa": "<ścieżka>", "kategoria": "<pieniądze | tożsamość | dostęp | inne>", "pliki": ["<glob>"] }
  ]
}
```

Nieznany klucz w `cr` = błąd konfiguracji (kod 2). Domyślne wartości skryptu są PUSTE (żadnego układu katalogów ani gałęzi nie ma w kodzie): brak `rejestr_cr`, `rejestr_znalezisk`, `katalogi_zrodel` albo `baza_galezi` tam, gdzie są potrzebne, = kod 2 z nazwą brakującego klucza. Nazwy projektów i gałęzi nie są zaszyte w skillu — żyją w tej konfiguracji.

## Wyjście: PR i pytania

- **Jeden PR.** Lokalnie ORK zakłada szkic. Tak samo z VPS: szkic do końca pracy, gotowy raz po zielonym wyniku na końcowym SHA głowy (limit rund: `references/limit-rund-i-luka-testowa.md`). Scalanie: zielony PR do staging scala ORK za zgodą właściciela, nigdy agent ani skrypt; produkcja tylko właściciel.
- Opis PR: co (jedno zdanie); tabela znalezisk (ID → stan → SHA → pliki → klasa luki); testy (osie: liczby, złączony HEAD: wynik, czerwień na starym kodzie); pytania (lista albo „brak").
- **Jedna lista pytań** w tej samej wiadomości co PR: `Q1. <jedna linia> | rekomendacja: <opcja> (<powód>) | alternatywa: <opcja>`.
- Raport postępu po każdym powrocie agenta: najwyżej 5 linii (wzór w `references/raport-i-pytania.md`), bez diffów.

## Tryb VPS i lokalnie

| stan VPS (profil: `vps`) | jak wykonujesz etap B |
|---|---|
| `podlaczony` | `heniek dispatch flow:cr-osi --galaz=<gałąź> --os=<id-ścieżki>` (podgląd: `--dry-run`); jedno zlecenie na ścieżkę. Zlecenie kosztuje — wydaje człowiek albo ORK za jego zgodą |
| `planowany` lub `brak` | agent w oknie orkiestratora, ta sama koperta (paczka `cr-zakres`), ten sam raport JSON |

Szczegóły i limity: `references/tryb-vps.md`.

## Żelazne zasady

1. **Jedno pytanie, nie formularz o zakres.** Brak okna czasu → dzisiaj, i powiedz to jawnie.
2. **Kandydaci z pomiaru, nie z pamięci sesji.** Zawsze skrypt albo git.
3. **Trzy sposoby wyboru zakresu (gałąź / epik / obszar) nie są trzema osiami recenzji.** Gałąź mówi „co wejdzie na produkcję", epik „jaka była intencja", obszar „co realnie dotknięte".
4. **Rejestr czytaj PRZED, zapisuj PO.** Wpis po zamkniętym CR jest częścią CR.
5. **CR bez poprawek ze SHA nie jest zrobiony.** `znaleziska wdrożone` tylko wtedy, gdy wiersze mają SHA.
6. **Model jawny przy każdym agencie**; CR i poprawki: Sonnet 5.5, lekkie zadania: Haiku 5.5 (własna polityka modeli projektu ma pierwszeństwo).
7. **Skrypt orkiestruje, model ocenia.**
8. **CR nie pisze testów e2e ani przeklików, nie commituje i nie scala.** Agenci nie commitują ani nie scalają.

## Tryb lekki dla jednej zmiany

Dla zmiany w 1 pliku (albo 1–2 plikach jednej ścieżki) poza pieniędzmi, tożsamością i dostępem pełna rura nie jest potrzebna. Gdy brakuje `.claude/projekt-heniek.json`, rejestru CR albo `docs/`, nie kończysz na samym STOP z kodem 2:

1. **Jeden recenzent** (osobny agent, read-only, model jawny) na zmianę, bez podziału na osie. Autor nie recenzuje własnego kodu.
2. **Bez konfiguracji i rejestru:** pomiń skrypty `cr-zakresy`, `cr-bramka-zamkniecia` i wpis do rejestru. Zakres bierz z `git diff --name-only <baza>...<glowa>`, testy z komendy testów projektu (profil `komenda_testow` albo `package.json`).
3. **Jawne oznaczenie niesprawdzonych etapów** w raporcie: `NIESPRAWDZONE: rejestr CR, bramka zamknięcia, osie integracyjne (tryb lekki, brak konfiguracji)`. Pominięty etap bez tej linii jest błędem.
4. **Wynik:** kod wyjścia (0 = recenzent i testy czyste; 1 = znaleziska otwarte; 2 = nic nie zmierzono, z opisem, czego brakuje i jaki jest następny krok) plus opis. Kod 2 bez opisu nie jest raportem.
5. Poprawki: agent poprawia pliki i zgłasza listę zmian, commit robi koordynator. Zasady twarde 1–8 obowiązują bez zmian.

Zmiana na ścieżce pieniędzy, tożsamości lub dostępu zawsze idzie pełną rurą.

## Uwagi operacyjne

- **Komenda testów:** uruchamiasz komendę z profilu projektu (`komenda_testow`) albo z `package.json`, nie zakładasz gołego `node --test`. W repo z TypeScriptem komenda zwykle ma flagi ładujące transpiler. Przykład (nie zaszyty w skillu): `node --experimental-strip-types --import <rejestr-transpilera> --test <pliki>`, gdzie rejestr transpilera to plik projektu z `package.json`. Zlecenie, które pomija te flagi, daje fałszywą czerwień.
- **Git Bash na Windows:** `python3` bywa atrapą (przekierowaniem do sklepu) i wiesza polecenie. Do skryptów pomocniczych używaj `node`.

## Czerwone flagi

| myśl | rzeczywistość |
|---|---|
| wklejasz właścicielowi diff albo streszczenie zmian | wróć do menu; o to nie prosił |
| pytasz „co chcesz zrecenzować?" | to pytanie ma zdjąć z właściciela ten skill |
| uruchamiasz recenzenta bez `git fetch` | recenzujesz nieaktualny stan |
| zamykasz CR bez wiersza w rejestrze | następny przebieg zaproponuje to samo |
| jeden agent dostaje trzy zakresy naraz | rozlana uwaga, uwagi stylistyczne zamiast defektów |
| listę plików bierzesz z pamięci, nie z `git diff --name-only` | brakuje konsumentów i danych: `references/kroki-skryptowe.md`, krok 3b |
| zmiana kontraktu danych bez sprawdzenia starych rekordów | krok 3b, człon (3), obowiązkowy |
| piszesz test e2e albo przeklik w ramach CR | to nie jest etap CR; zleć przez ORK |
| „recenzja zielona, więc czysto" bez sprawdzenia historii plików | zero znalezisk jest podejrzane: `references/soczewki-ryzyka.md` |

## Referencje

- `references/rura-i-procedura.md` — pełny kontrakt RURA, definicja osi, procedura A–H, format sekcji fali.
- `references/kroki-skryptowe.md` — kroki 1–4: menu, pokrycie, zlecenie, zbiór plików złączenia, zapis do rejestru.
- `references/limit-rund-i-luka-testowa.md` — limit rund i klasy luk testowych.
- `references/raport-i-pytania.md` — raport postępu, tabela zamknięcia, bramka, lista pytań.
- `references/soczewki-ryzyka.md` — soczewki dla kodu już scalonego i zasada „zero znalezisk".
- `references/tandem-i-noc.md` — tryb tandem na serwerze i wynik pracy nocnej.
- `references/tryb-vps.md` — tryb VPS i lokalny, limity, dobór modeli.
- `references/os-integracyjna.md` — wyznaczanie zbioru plików osi i klasy defektów dla recenzenta.
- `references/lekcje-i-znaczniki.md` — skąd biorą się reguły, znaczniki ryzyka.
- Skille pokrewne: `quick-fix-qa-plus` (nadzór nad jednym zadaniem z DoD), `test-epiku` (testy fali, mapa testów); jeśli masz te skille: `przeklik-mieszany` (stan współdzielony po scaleniu fali), `paczka-joba` (koperta zlecenia).

## PROTOKOL-POSTEPU (agenci)

Każdy brief agenta zlecany z tego skilla kończy się blokiem „PLAN I POSTĘP” z pliku `protokol-postepu.md` (katalog references skilla `rdzen-ork`, jeśli masz ten skill; bez niego trzymaj ten sam schemat pól: `nazwa`, `etap`, `brief`, `kroki`, `krok`, `eta_min`, `teraz`) (etap w pliku postępu: CR|Poprawki). Nazwa w pliku = opis agenta; ostatni zapis `krok = liczba kroków + 1`. Brief bez bloku jest niepełny: dopisz go przed wysłaniem. Katalog plików postępu podaje zleceniodawca (nie zgaduj ścieżki).
