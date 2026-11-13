# Heniek Start: darmowa paczka skilli jakości

Pięć skilli Claude Code, które pilnują, żeby "zrobione" znaczyło "sprawdzone": naprawa z dowodem, code review kończący się jednym PR, dzienna runda testów fali, przekliki w przeglądarce i naprawa UX/UI. Działa w każdym projekcie, bez VPS i bez innych pluginów.

**Liczba i lista skilli mają jedno źródło:** sekcję `lista` w `pakiet.json` (tu, w tym katalogu). Plugin, ten plik, marketplace, instalator, ceny i linki serwisu są z nią sprawdzane testem `scripts/paczka-darmowa-piatka.test.mjs`.

**Ta paczka jest generowana.** Skille w `skills/` nie są edytowane ręcznie. Źródłem jest `plugins/harness-heniek/skills/`, a skład i nazwy opisuje `pakiet.json`. Zmiana w źródle idzie przez `node scripts/generuj-paczke-darmowa.mjs --zapisz` (z katalogu głównego repozytorium), a zgodność sprawdza `--sprawdz`.

## Instalacja (jedno polecenie)

W Claude Code (Desktop albo CLI):

```text
/plugin marketplace add krzysiekplesniak/heniek-darmowe-skille
/plugin install heniek-start-darmowe@heniek-darmowe
```

Albo z terminala: `claude plugin marketplace add krzysiekplesniak/heniek-darmowe-skille && claude plugin install heniek-start-darmowe@heniek-darmowe`.

Po instalacji otwórz nowe okno w katalogu swojego projektu i napisz na przykład **"zróbmy CR"**, **"przetestuj falę"** albo **"szybka poprawka: przycisk nie reaguje"**.

## Co dostajesz

| skill | do czego | powiedz na przykład |
|---|---|---|
| `quick-fix-qa-plus` | mała poprawka, której wynik ma być **udowodniony**: definicja gotowości przed kodem, czterowarstwowy dowód po, osobny recenzent | "szybka poprawka, ale musi być sprawdzone", "weryfikuj cudzy wniosek" |
| `zakres-cr` | code review od zakresu do **jednego PR i jednej listy pytań**: recenzenci tylko do odczytu, weryfikacja każdego znaleziska, poprawki w tej samej fali, bramka zamknięcia | "zróbmy CR", "CR gałęzi feat/koszyk", "co do recenzji?" |
| `test-epiku` | dzienna, celowana runda testów fali: mapa zmian, stan przed, luki, nowe testy z dwiema kontrolami negatywnymi, jeden przebieg po stagingu | "przetestuj falę", "dopisz testy do tych zmian" |

Skille współpracują w kolejności: `quick-fix-qa-plus` albo własny kod, potem `zakres-cr` i `test-epiku`; `przekliki-ogorkowe` i `ux-fix-orchestrator` stoją obok (patrz niżej). Każdy trzeba wywołać wprost; odsyłacze między nimi są drogowskazami, nie łańcuchem automatycznym.

## Dodatkowe skille (nie są generowane)

Te dwa też należą do piątki, są w katalogu `skills/`, ale generator ich nie rusza i nie kasuje:

- `przekliki-ogorkowe`: scenariusze Given/When/Then klikane w przeglądarce telefonu; ścisły silnik, krok bez definicji nie jest zielony.
- `ux-fix-orchestrator`: audyt i naprawa UX/UI według tokenów i komponentów Twojego projektu.

## Jeden plik konfiguracji projektu

Skille czytają `.claude/projekt-heniek.json` w Twoim repo: gałąź bazową, komendy (testy, typy, build), środowiska (lokalne, staging, hosty produkcji do zablokowania), tokeny UI i **ścieżki klienta** (np. zakup, logowanie) z globami plików, wagą i testami. Wzór: `skills/zakres-cr/assets/projekt-heniek.przyklad.json`. Nie masz pliku? Skill zaproponuje go przy pierwszym użyciu i zapisze po Twojej zgodzie. Plik nie zawiera sekretów i nie powinien ich zawierać.

## Wymagania

- Git. GitHub CLI (`gh`) opcjonalnie (bez niego PR zakładasz z linku po `git push`).
- Node 20+ dla skryptów paczki (bez zależności npm).
- Przekliki: `@playwright/test` w Twoim projekcie.
- Narzędzie przeglądarki w Claude Code (chrome-devtools MCP, Playwright MCP albo przeglądarka wbudowana) dla weryfikacji w `quick-fix-qa-plus` i `ux-fix-orchestrator`.

## Opcjonalne skille zewnętrzne (nie są częścią paczki)

`ux-fix-orchestrator` potrafi skorzystać z dwóch skilli, jeśli masz je zainstalowane osobno; bez nich używa wbudowanej checklisty:

| skill | autor | licencja |
|---|---|---|
| `ui-ux-pro-max` | Next Level Builder (github.com/nextlevelbuilder/ui-ux-pro-max-skill) | MIT |
| `frontend-design` | Anthropic (plugin `frontend-design` w oficjalnym marketplace Claude Code) | Apache-2.0 |

Paczka nie zawiera ich kodu ani treści; jedynie wskazuje je jako opcjonalne narzędzia.

## Co dalej

Paczka to proces jakości dla jednej osoby i jednego okna. Pełny harness Heńka (plugin `harness-heniek`: wątki, plansza, discovery, dowody z SHA, praca nocna na VPS) to osobny, płatny produkt.

