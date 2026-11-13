---
name: quick-fix-qa-plus
description: Rozszerzona wersja quick-fix dla zadań, w których wynik musi być UDOWODNIONY, nie tylko wykonany — naprawy z niepewną diagnozą, weryfikacja cudzego twierdzenia, audyt „czy to naprawdę tak działa". Dokłada Definition of Done przed kodem i czterowarstwowy dowód po. Po kodzie wywołuje `zakres-cr` (CR z poprawkami) i `test-epiku` (testy po CR). Używaj, gdy koszt fałszywego „gotowe" jest wysoki.
---

# Quick Fix + QA PLUS

Wynik ma być **udowodniony**, nie tylko wykonany. Luki w dowodzie są policzone
i jawnie podane, nie przemilczane. Metoda wyłoniona w porównaniu czterech podejść
do tego samego zadania; ta sama nazwa i ten sam rdzeń w każdej kopii (paczka darmowa,
kurs, VPS).

## Kiedy Plus, kiedy matka

| Sytuacja | Tryb |
|---|---|
| Diagnoza jest cudzym twierdzeniem, którego nikt nie sprawdził | pełny PLUS |
| „Luka danych", „tego nie da się", „to już naprawione" — do rozstrzygnięcia | pełny PLUS |
| Naprawa, po której ktoś zapyta „skąd wiesz, że działa" | pełny PLUS |
| Mały task S, jasna diagnoza, widoczny efekt | tryb lekki: Fazy 1–3 i warstwa 1 dowodu; warunki DoD 4 i 6 mogą być N/D z jednozdaniowym powodem (jawnie) |
| Epik M/L z falami | najpierw podział na zadania (`backlog`, jeśli masz ten skill; bez niego podziel epik na zadania sam), potem ta metoda na każde zadanie; testy fali — `test-epiku` |

**Test praktyczny:** jeśli po skończeniu napiszesz „gotowe" i nie umiesz dopisać
komendy, którą ktoś sprawdzi to w 30 sekund — potrzebujesz PLUS.

## Przebieg — siedem faz (matka ma cztery)

Kolejność twarda. Zawsze zaczynasz od faza -1 (katalog roboczy), potem bramka wejścia.

1. Faza -1 — katalog roboczy (worktree albo gałąź) przed dotknięciem kodu.
2. Faza 0.0 — bramka wejścia (cztery pytania).
3. Faza 0.5 — Definition of Done (sześć warunków), przed kodem.
4. Fazy 1–3 — zakres, kod, QA w przeglądarce (krótko, niżej).
5. Faza 5 — wywołanie skilla `zakres-cr`: CR z poprawkami, przy wypchnięciu zmiany poza komputer.
6. Testy po CR — wywołanie skilla `test-epiku`: autor testu różny od autora kodu.
7. Faza 4 — dowód czterowarstwowy, zbiera wyniki z kroków 4–6.
8. Werdykt — DoD N/6 i Dowód N/4.

Uwaga do kolejności: poprzednia wersja metody dawała dowód przed recenzją.
Kolejność z kroków 5–7 wynika z decyzji o testach po CR.

---

## Przed kodem: katalog roboczy (faza -1)

Przed fazą 0 wydziel osobny katalog roboczy dla tematu: `git worktree add`, albo
skrypt projektu tworzący worktree, jeśli profil projektu go wskazuje. Nie kodujesz
na gałęzi głównej.

Powód: zmiana w głównym checkoucie blokuje cudzą pracę. Wyjątek: zmiany wyłącznie
w plikach skilli i dokumentacji mogą być na głównym checkoucie; worktree i tak
preferowany przy więcej niż jednym–dwóch commitach.

Pod orkiestratorem katalog przydziela orkiestrator (skill `harness-orkiestrator`, jeśli masz ten skill;
po stronie wątku skill `watek-harnessu`, jeśli masz ten skill). Bez przydziału nie zakładasz własnego.

## Faza 0.0 — bramka wejścia

Cztery pytania, odpowiadasz przed czymkolwiek, także przed briefingiem:

| # | pytanie | odmowa startu, gdy |
|---|---|---|
| 1 | Skąd przyszło i czy ma numer w rejestrze zadań? | wchodzi z audytu, synchronizacji, zrzutu albo „a przy okazji" i nikt go nie zapisał |
| 2 | Czyja to premisa i kto ją ZMIERZYŁ? | premisa jest cudzym zdaniem z dokumentu, nie pomiarem |
| 3 | ⭐ Czy to leży na ścieżce, którą przechodzi KLIENT? | nie wiesz — wtedy mierzysz ścieżkę użytkownika (dwie minuty) zanim napiszesz linijkę |
| 4 | Co się stanie, jeśli tego NIE zrobię? | nie umiesz odpowiedzieć — zadanie bez kosztu zaniechania nie jest blokerem |

Szczegóły: `references/bramka-wejscia.md`.

## Faza 0.5 — Definition of Done (przed kodem)

Sześć warunków. Każdy dostaje ✅ / ⚠️ / **N/D z powodem**. „Nie wiem" nie jest odpowiedzią.

| # | warunek | co znaczy |
|---|---|---|
| 1 | Adres, nie nazwa | plik, funkcja, identyfikator, próg |
| 2 | Asercja liczbowa | wynik jest LICZBĄ, nie przymiotnikiem |
| 3 | Kontrola pozytywna | zmierz równolegle coś, co MUSI dać inny wynik |
| 4 | Bramka pinuje KLASĘ | test łapie rodzinę błędów, nie jeden przypadek; N/D dla audytu bez naprawy |
| 5 | Mierzone na żywym systemie | plik wygenerowany offline to nie działająca aplikacja: ⚠️, nie ✅ |
| 6 | Czerwień-zieleń przez KONTROLĘ NEGATYWNĄ | procedura w `references/kontrola-negatywna.md`; bramka, której nie widziałeś na czerwono, nie jest bramką |

Adaptacja jest dozwolona i ma być jawna. Ciche pominięcie warunku jest cięższym
błędem niż napisanie N/D. Szczegóły: `references/definition-of-done.md`.

## Fazy 1–3 — zakres, kod, QA

**Faza 1 — zakres.** Przeczytaj zgłoszenie (numer z rejestru), zrób grep po repo,
przeczytaj powiązane pliki. Zapisz decyzję QA: **QA-needed** (zmiana widoczna w UI)
albo **QA-skip** (logika, kontrakt, test) — z powodem.

**Faza 2 — kod.** Najmniejsza zmiana. Uruchom komendy weryfikacji z profilu projektu
(typy, testy jednostkowe): komendę testów bierz z profilu (`komenda_testow`) albo `package.json`, nie zakładaj `node --test` bez flag (w repo z TypeScriptem potrzebne są flagi transpilera; przykład: `node --experimental-strip-types --import <rejestr-transpilera> --test <pliki>`, gdzie rejestr transpilera to plik projektu z `package.json`). W Git Bash na Windows `python3` bywa atrapą i wiesza polecenie, używaj `node`. Padające testy naprawiasz przed fazą 3. Po zmianie zrób
rewizję QA: dotknięty rendering = QA-needed.

**Faza 3 — QA w przeglądarce.** Tylko QA-needed; pomiń z adnotacją „QA-skip: powód".
Mierz na buildzie produkcyjnym albo na działającym środowisku, nie na serwerze
deweloperskim, jeśli ten blokuje narzędzie. Przejdź ścieżkę użytkownika do ekranu
zmiany i zapisz, co widać.

## Faza 4 — dowód czterowarstwowy

Cztery warstwy od najtańszej do najdroższej: (1) unit na prawdziwych funkcjach
projektu, (2) integracyjny na realnej ścieżce, (3) przeklik e2e, (4) headless na
żywym środowisku z danymi (tylko odczyt). Warstwa niezmierzona zostaje w tabeli
z ⚪ i komendą, która ją domierzy. Usunięcie wiersza jest cięższym błędem niż
niezmierzenie. Szczegóły: `references/dowod-czterowarstwowy.md`.

Dowody z testów z kroku 6 wchodzą do warstw 1–3.

## Faza 5 — wywołanie `zakres-cr` (CR z poprawkami)

Bramka stoi przy wypchnięciu zmiany poza komputer (gałąź do integracji, PR), nie
przy każdym commicie.

Uruchom skill **`zakres-cr`** na zakresie tej zmiany (gałąź, PR albo lista commitów).
Skill prowadzi pełną rurę: recenzenci read-only, triaż, poprawki w tej samej fali,
bramkę zamknięcia. Recenzent jest osobnym agentem z osobnym kontekstem — autor nie
recenzuje własnego kodu. Recenzent pracuje metodą Czytanie kontradyktoryjne
(szczegóły w `references/recenzent.md`).

Słownik stanów znalezisk, którego trzymasz się przy odbiorze: **NAPRAWIONE | OBALONE |
CZYSTO | PYTANIE Qn**. Każde `OBALONE` i `NAPRAWIONE` ma dowód (komenda, wynik, SHA).

Gdy zmiana dodała bramkę, sprawdź ją kontrolą negatywną (`references/kontrola-negatywna.md`).
Recenzja z lektury jest argumentem, nie pomiarem — tak ją oznacz.

Pełny opis: `references/recenzent.md`.

## Testy po CR — wywołanie `test-epiku`

Po zamknięciu CR uruchom skill **`test-epiku`** na tej zmianie. Zasady:

- **Autor testu różny od autora kodu.** Test piszą inni agenci, nie ci, którzy napisali zmianę.
- Test asertuje wynik widoczny dla użytkownika, nie kształt źródła (regex po pliku nie jest dowodem).
- Każdy nowy test ma kontrolę negatywną: po zepsuciu zachowania musi zczerwienieć. Bez `git stash` (stos jest współdzielony): kopia pliku do katalogu tymczasowego, zmiana, test, przywrócenie z kopii albo `git checkout -- <plik>` (`references/kontrola-negatywna.md`).
- Wynik (testy uruchomione / nowe / luki z powodem) wchodzi do warstw 1–3 dowodu.

## Praca w tle

Ciężkie, mierzalne fragmenty (CR, przeklik, przeglądy partiami) idą do agentów
w tle, a wątek główny przyjmuje kolejne zlecenia. DoD i decyzje z użytkownikiem
zostają w głównym wątku; delegacja dotyczy wykonania, nie decydowania.
Szczegóły i tabela: `references/praca-w-tle.md`.

## Reguły testów e2e i staging

Test asertuje wynik dla użytkownika. PR zmieniający ścieżkę użytkownika dopisuje
albo aktualizuje scenariusz e2e. Nowa wartość w unii lub enumie przechodzi po
wszystkich `switch` i mapach konsumentów. Czerwone CI nie jest „starą czerwienią".
Zielony lokalnie nie dowodzi zielonego w CI. Poziomy testów A/B/C i szkic PR:
`references/reguly-e2e-i-staging.md`.

## Werdykt

Werdykt kończący ma dwie liczby, obie jawne:

- **DoD: N/6** warunków spełnionych (reszta z powodem N/D albo ⚠️)
- **Dowód: N/4** warstw zmierzonych (reszta jako ⚪ z poleceniem do domierzenia)

Raport bez dwóch liczb nie jest domknięty.

## Artefakty pomiaru

Sonda, która daje zero, częściej jest zepsuta niż prawdziwa. Pierwszy zerowy wynik
jest hipotezą, nie wynikiem. Przed ogłoszeniem „tego nie ma" przejdź listę:
`references/artefakty-pomiaru.md`.

## Red flagi — zatrzymaj się

- DoD wypełniony **po** kodzie → to opis, nie Definition of Done.
- Warunek DoD dostaje „nie wiem" → wpis nie jest gotowy; dopytaj albo zmierz.
- Brak kontroli pozytywnej → nie wiadomo, czy sonda patrzy we właściwe miejsce.
- Sonda przepisuje logikę zamiast importować funkcje → mierzysz własne rozumienie kodu.
- Usunięta z tabeli warstwa, której nie zmierzono → najcięższy błąd tej metody.
- „Zmierzone" na artefakcie offline → to warstwa 1, nie 4.
- Werdykt bez N/6 i N/4 → raport niedomknięty.
- Regresja zgłoszona ze świeżego katalogu roboczego bez sprawdzenia na gałęzi obok → prawie na pewno brak artefaktów budowania.
- Zero po pierwszej sondzie ogłoszone jako wynik.
- Argument z lektury podany tym samym tonem co pomiar → rozdziel je jawnie.
- Testy napisane przez autora kodu po CR → nie spełniają warunku „autor testu różny od autora kodu".

## Referencje

- `zakres-cr` — CR z poprawkami i słownik stanów (krok 5).
- `test-epiku` — testy po CR, autor testu różny od autora kodu (krok 6).
- `backlog` (jeśli masz ten skill) — bramka premisy i podział epików na zadania.
- `paczka-joba` (jeśli masz ten skill) — koperta zlecenia, gdy recenzent albo test ma działać jako zadanie w tle.
- `harness-orkiestrator` (jeśli masz ten skill) — przydział katalogów roboczych pod orkiestratorem.
- `references/` w tym skillu — pełne kroki metody.
