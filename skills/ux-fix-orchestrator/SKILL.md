---
name: ux-fix-orchestrator
description: Dyrygent audytu i NAPRAWY UX/UI istniejącej aplikacji. Używaj, gdy użytkownik mówi "popraw stronę pod względem UX/UI", "przejdź po całej aplikacji", "sprawdź zgodność z design systemem", "audyt UX", "popraw odstępy / kontrasty / spójność komponentów", albo wskazuje ekran i mówi "nie podoba mi się, popraw". Kanon wizualny bierze z tokenów i komponentów TWOJEGO projektu, rozstawia agentów po ekranach z rozdzielonymi plikami, pilnuje bramki i żywej weryfikacji w przeglądarce, raportuje uczciwie w klasach. NIE do budowy nowego ekranu od zera, NIE do wydajności. Use when "UX audit", "fix UI consistency", "design system compliance", "polish the UI", "contrast and spacing issues".
---

# UX Fix Orchestrator: dyrygent naprawy UX/UI

Dyrygent obsadza cztery role, których zwykle nikt nie obsadza: **kto wybiera zakres · kto rozdziela pliki między agentów · kto rozstrzyga konflikt kanon projektu vs dobra praktyka · kto dopuszcza wynik.** Bez niego agenci wchodzą sobie w pliki (dwa przebiegi typów w tej samej minucie dają różne błędy) i nie zostaje ślad tego, co odłożono.

## Kanon = tokeny i komponenty projektu użytkownika

Źródła, w tej kolejności:

1. Pole `ui` w `.claude/projekt-heniek.json`: `tokeny` (CSS custom properties, `@theme`, konfiguracja Tailwind, plik tokenów JSON), `komponenty` (katalog komponentów bazowych), `kanon` (dokument zasad, jeśli jest).
2. Brak pola: znajdź sam (`git grep -l -- "--[a-z-]*:"` w plikach CSS, konfiguracja Tailwind, katalog `components/ui`), pokaż użytkownikowi listę i zapisz w pliku projektu po jego "tak".
3. Brak tokenów: kanonem jest `references/checklista-ux.md`, a pierwszym znaleziskiem klasy 2 "brak skali tokenów".

Kanon czytasz z kodu, nie z pamięci: skala typografii, odstępów, promieni, warstw (z-index), kolorów z parami tło/tekst.

## Pięć faz (kolejność nienegocjowalna)

### Faza 0: REKONESANS narzędzi

Zanim ruszysz kod, powiedz użytkownikowi, czym dysponujesz i **czego żadne z narzędzi nie zrobi**:

| narzędzie | czym JEST | czym NIE JEST |
|---|---|---|
| tokeny i komponenty projektu | kanon TEGO projektu | wiedza ogólna |
| `references/checklista-ux.md` (w paczce) | ogólne progi: dotyk 44 px, kontrast 4,5:1 i 3:1, siatka 4/8, stany | skaner kodu |
| `ui-ux-pro-max` (opcjonalny, jeśli zainstalowany; MIT) | przeszukiwalna baza reguł UX, palet i checklist | skaner kodu, profiler |
| `frontend-design` (opcjonalny, jeśli zainstalowany; Apache-2.0) | rzemiosło wykonania, kierunek estetyczny | źródło kanonu istniejącej aplikacji |
| narzędzie przeglądarki (chrome-devtools MCP, Playwright MCP) | zrzuty, DOM, kontrast na żywym ekranie | zastępstwo dla osądu |

Brak narzędzi opcjonalnych niczego nie blokuje: zastępuje je checklista z paczki.

### Faza 1: HIERARCHIA (jedno pytanie)

*Kto wygrywa, gdy ogólna dobra praktyka kłóci się z kanonem projektu?* Odpowiedź z datą w notatce audytu. Rozjazd kanon vs dobra praktyka jest **sam w sobie znaleziskiem**, nie rozstrzyga się automatycznie na korzyść stanu istniejącego.

### Faza 2: AUDYT (tylko odczyt, jeden agent na ekran)

- 1 agent = 1 ekran (reguły trzeba widzieć razem, nie po jednej).
- Każdy dostaje: pliki kanonu, checklistę, zgłoszenia użytkownika, **klasy defektów** z `references/klasy-defektow.md`.
- Każdy mierzy **te same** elementy współdzielone (przycisk główny, karta, nagłówek), żeby synteza mogła je porównać.
- Na końcu **synteza krzyżowa**: co jest niespójne MIĘDZY ekranami.
- Agenci przeglądarkowi: każdy we własnej karcie; pomiary wydajności pojedynczo (ślad jest globalny dla przeglądarki).

### Faza 3: NAPRAWA (maks. 4 agenty, ROZDZIELONE pliki)

1. **Rozdziel katalogi, nie zadania.** Każdy agent: katalogi, które wolno edytować, i lista "NIE dotykaj" z powodem.
2. **Komponenty współdzielone = osobny właściciel.** Kto ich używa, a nie jest właścicielem, raportuje problem, nie naprawia.
3. **Zakaz zmian API i propsów** przy poprawkach wizualnych.
4. **Świeżo zatwierdzone elementy wyklucz jawnie.**
5. Każdy agent: typy + testy **swoich** plików, nie pełna suita.
6. **Zero commitów przez agentów.** Commituje dyrygent, raz, po bramce.
7. Wątpliwe lub duże: **raportuj, nie ruszaj**. To odróżnia poprawkę zgodności od przemyconego redesignu.

Szkielet promptu agenta: `references/prompt-agenta-naprawy.md`.

### Faza 4: BRAMKA + ŻYWA WERYFIKACJA (dyrygent)

1. `git status --short`: tylko oczekiwane pliki.
2. Typy: zero błędów.
3. **Pełna suita testów** (agenci widzieli tylko swoje).
4. **Żywy przeklik** przez naprawione ekrany, zrzuty telefon (375 px) i desktop. Bez tego nie mówisz "gotowe": błąd zawijania ceny przechodzi typy i testy, łapie go dopiero zrzut przy wąskim ekranie.
5. Jeden commit z uzasadnieniem (gałąź, nie gałąź główna), PR.
6. Lista odłożonych decyzji.

### Faza 5: ROZLICZENIE (w klasach)

- **Klasa 1, realne i widoczne:** kontrast poniżej progu, cel dotyku poniżej 44 px, element niewidoczny, błąd tekstu. Z liczbami.
- **Klasa 2, higiena systemu:** tokenizacja, dzikie wartości. Wprost: zapobiegawcze, nie natychmiastowe.
- **Klasa 3, audyt potwierdził, że jest dobrze.** To też wynik.
- Osobno: **co NIE zostało zrobione** (ekrany zaudytowane, ale nienaprawione; nigdy nietknięte). Bez tego użytkownik myśli, że aplikacja jest przejrzana w całości.

## Twarde zasady

| # | zasada |
|---|---|
| Z1 | Audyt to nie backlog. Do listy zadań wchodzi to, na co użytkownik powiedział "tak", plus jawna lista odłożonych decyzji |
| Z2 | Testy czytające źródło regexem pilnują STAREGO napisu. Gdy poprawka je czerwieni: pilnują kształtu (przepisz na intencję, z komentarzem) czy złapały regresję (cofnij)? Nigdy nie kasuj asercji bez śladu |
| Z3 | Zmiana wzorca = wszystkie wystąpienia naraz. Ten sam przycisk w 3 miejscach zmieniony w jednym to rozjazd gorszy niż stan wyjściowy: odłóż do jednej decyzji |
| Z4 | Token zmieniasz w jednym miejscu i sprawdzasz zasięg: `git grep -c` konsumentów przed zmianą, wariant ciemny (albo inny motyw) po zmianie |
| Z5 | Nie "poprawiasz" świadomych decyzji: wartość spoza skali z komentarzem i datą to werdykt, nie błąd |

## Czerwone flagi

- Agenci bez listy "NIE dotykaj" -> kolizje w typach.
- Agent commituje -> odbierz mu to.
- "Gotowe" bez żywego przekliku -> faza 4, punkt 4.
- Same tokenizacje raportowane jako sukces -> faza 5, nazwij klasy uczciwie.
- Edycja komponentów bazowych "przy okazji" jednego ekranu -> zmiana dla całej aplikacji, osobna tura.
