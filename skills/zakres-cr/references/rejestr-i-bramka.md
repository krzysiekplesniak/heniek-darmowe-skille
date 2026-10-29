# Rejestry i bramka zamknięcia

Dwa pliki w repo użytkownika (zakładasz przy pierwszym CR, jeśli ich nie ma):

| plik | co | kiedy |
|---|---|---|
| `docs/cr/rejestr-cr.md` | jeden wiersz na zamknięty CR: data, zakres (dokładnie ten klucz, który był w menu), wynik, SHA poprawek, kto | czytany PRZED menu (status "ostatni CR"), zapisywany PO zamknięciu |
| `docs/cr/znaleziska.md` | sekcja `## Fala <id>` na każdą rurę | wiersz powstaje, gdy agent wraca, nie zbiorczo na koniec |

## Wiersz rejestru CR

```
| Data | Zakres | Typ | Wynik | Poprawki (SHA) | Kto |
|---|---|---|---|---|---|
| 2026-01-15 | feat/koszyk-rabaty | gałąź | znaleziska wdrożone | abc1234, def5678 | recenzent + poprawiacz |
```

`Zakres` to dokładnie klucz z menu (gałąź, `a..b`, ścieżka `P1`), inaczej ten sam zakres wróci jako nierecenzowany. `znaleziska wdrożone` wpisujesz dopiero, gdy poprawki mają SHA. Zakres świadomie odłożony: osobna sekcja "Zaproponowane, jeszcze nie zrecenzowane" z powodem i warunkiem powrotu.

## Sekcja fali

```markdown
## Fala <id> (<data>)

Zakres: `<baza>...<głowa>` · Osie: P1 (3 pliki), P2 (1 plik)
Pliki: `src/checkout/page.tsx` (P1), `src/lib/auth/session.ts` (P2)

| # | STAN | SHA | DOWÓD |
|---|---|---|---|
| CR-1 | NAPRAWIONE | `abc1234` | Luka testowa: brak testu |
| CR-2 | OBALONE | - | `npm test -- auth` zielony; warunek sprawdzany w session.ts:42 |
| CR-3 | PYTANIE Q1 | - | - |
| P2 | CZYSTO | - | testy osi 12/12, pliki bez zmian od ostatniego CR sprawdzone |

### Commity bez znaleziska
| SHA | Powód |
|---|---|

### Pytania
| Q | Decyzja | Znaleziska | Rekomendacja |
|---|---|---|---|
| Q1 | ... | CR-3 | ... |
```

Słownik stanów jest zamknięty: `NAPRAWIONE / OBALONE / PYTANIE Qn / CZYSTO`. Nie "SCALONE", "OTWARTE", "CZEKA NA DECYZJĘ". ID nadaje orkiestrator (kanoniczne), nie recenzent: numeracje recenzentów się rozjeżdżają.

## Bramka zamknięcia (etap F)

Sprawdzasz poleceniami, nie pamięcią. Każdy punkt niespełniony = wracasz do etapu C/D, nie do użytkownika.

| # | warunek | jak sprawdzić |
|---|---|---|
| a | każdy wiersz fali w stanie końcowym | brak innych słów w kolumnie STAN |
| b | każdy SHA `NAPRAWIONE` istnieje i jest przodkiem głowy | `git merge-base --is-ancestor <sha> <głowa>` dla każdego (exit 0) |
| c | każdy commit nie-merge w `baza..głowa` przypisany do znaleziska albo do "Commity bez znaleziska" | `git log --no-merges --format=%h <baza>..<głowa>` porównane z kolumną SHA i tabelą |
| d | każde `PYTANIE Qn` ma Qn w tabeli pytań | porównanie dwóch kolumn |
| e | `OBALONE` ma dowód (polecenie + wynik) | kolumna DOWÓD niepusta |
| f | testy, typy i build zielone na złączonej głowie | polecenia z `komendy` pliku projektu |

## Opis PR (etap G)

- tabela: ID -> STAN -> SHA -> pliki,
- wyniki testów osi i poleceń z punktu f,
- zliczenie klas luk testowych ("z 7 poprawek: 4 brak testu, 2 kształt, 1 warstwa"): mówi, gdzie siatka testów jest dziurawa,
- lista pytań Q1..Qn z rekomendacją, ta sama, którą dostaje użytkownik.

Scala użytkownik. Skill kończy się linkiem PR i listą pytań, nie scaleniem.
