# Heniek: darmowe skille jakości dla Claude Code

Pięć skilli, które pilnują, żeby "zrobione" znaczyło "sprawdzone": code review kończące się jednym PR, przekliki ścieżek klienta w prawdziwej przeglądarce, mała poprawka z weryfikacją, naprawa UX/UI według Twojego design systemu i dzienna runda testów fali. Działa w każdym projekcie, bez serwera i bez innych pluginów. Licencja MIT.

## Instalacja (jedno polecenie)

W Claude Code (Desktop albo CLI):

```text
/plugin marketplace add krzysiekplesniak/heniek-darmowe-skille
/plugin install heniek-start-darmowe@heniek-darmowe
```

Albo z terminala: `claude plugin marketplace add krzysiekplesniak/heniek-darmowe-skille && claude plugin install heniek-start-darmowe@heniek-darmowe`.

Po instalacji otwórz nowe okno w katalogu swojego projektu i napisz na przykład **"zróbmy CR"** albo **"przeklikaj ścieżkę logowania"**.

Wolisz jeden skill bez pluginu? Skopiuj wybrany katalog z `skills/<nazwa>` do `.claude/skills/` w swoim projekcie (albo do `~/.claude/skills/`).

## Co dostajesz

| skill | do czego | powiedz na przykład |
|---|---|---|
| [`zakres-cr`](skills/zakres-cr) | code review od zakresu do **jednego PR i jednej listy pytań**: recenzenci tylko do odczytu, weryfikacja każdego znaleziska, poprawki w tej samej fali, bramka zamknięcia. Osie = ścieżki klienta z pliku projektu | "zróbmy CR", "CR gałęzi feat/koszyk", "co do recenzji?" |
| [`przekliki-ogorkowe`](skills/przekliki-ogorkowe) | scenariusze Given/When/Then (po polsku lub angielsku) klikane w przeglądarce telefonu; ścisły silnik: krok bez definicji nie jest zielony, produkcja zablokowana | "napisz przeklik zakupu", "przeklikaj logowanie" |
| [`quick-fix-qa`](skills/quick-fix-qa) | mała poprawka: briefing przed kodem, kod, weryfikacja w przeglądarce, recenzja osobnym agentem, PR | "szybka poprawka: przycisk Zapisz nie reaguje" |
| [`ux-fix-orchestrator`](skills/ux-fix-orchestrator) | audyt i naprawa UX/UI według **tokenów i komponentów Twojego projektu**: agenci po ekranach z rozdzielonymi plikami, bramka, żywa weryfikacja, raport w klasach | "popraw kontrasty i odstępy w całej aplikacji" |
| [`test-epiku`](skills/test-epiku) | dzienna, celowana runda testów fali: mapa zmian, stan przed, luki, nowe testy z dwiema kontrolami negatywnymi, jeden przebieg po stagingu | "przetestuj falę", "dopisz testy do tych zmian" |

## Jeden plik konfiguracji projektu

Skille czytają `.claude/projekt-heniek.json` w Twoim repo: gałąź bazowa, komendy (testy, typy, build), środowiska (lokalne, staging, hosty produkcji do zablokowania), tokeny UI i **ścieżki klienta** (np. zakup, logowanie) z globami plików, wagą i testami. Wzór: [`skills/zakres-cr/assets/projekt-heniek.przyklad.json`](skills/zakres-cr/assets/projekt-heniek.przyklad.json). Nie masz pliku? Skill zaproponuje go przy pierwszym użyciu i zapisze po Twojej zgodzie. Plik nie zawiera sekretów i nie powinien ich zawierać.

Sprawdzenie pliku (struktura i to, że każdy glob trafia w istniejący plik repo):

```bash
node <katalog pluginu>/skills/zakres-cr/scripts/osie.mjs --waliduj
```

## Wymagania

- Git. GitHub CLI (`gh`) opcjonalnie (bez niego PR zakładasz z linku po `git push`).
- Node 20+ dla skryptów paczki (bez zależności npm).
- Przekliki: `@playwright/test` w Twoim projekcie.
- Narzędzie przeglądarki w Claude Code (chrome-devtools MCP, Playwright MCP albo przeglądarka wbudowana) dla weryfikacji w `quick-fix-qa` i `ux-fix-orchestrator`.

## Opcjonalne skille zewnętrzne (nie są częścią paczki)

`ux-fix-orchestrator` potrafi skorzystać z dwóch skilli, jeśli masz je zainstalowane osobno; bez nich używa wbudowanej checklisty:

| skill | autor | licencja |
|---|---|---|
| `ui-ux-pro-max` | Next Level Builder (github.com/nextlevelbuilder/ui-ux-pro-max-skill) | MIT |
| `frontend-design` | Anthropic (plugin `frontend-design` w oficjalnym marketplace Claude Code) | Apache-2.0 |

Paczka nie zawiera ich kodu ani treści; jedynie wskazuje je jako opcjonalne narzędzia.

## Testy skryptów paczki

```bash
node --test skills/zakres-cr/scripts/osie.test.mjs
node --test skills/przekliki-ogorkowe/scripts/gherkin.test.mjs
```

Katalog `evals/` zawiera przypadki dla `claude plugin eval` (wyzwalanie skilli i jakość wyniku).

## Licencja

MIT, zobacz [LICENSE](LICENSE).
