# Menu zakresów: gdy użytkownik nie powiedział, co recenzować

Cel: lista kandydatów z **pomiaru**, nie z pamięci sesji. Sesja widzi swoje commity; git widzi wszystkie refy, w tym cudze gałęzie i te, o których nikt już nie pamięta.

## Pomiar (okno domyślne: dzisiaj)

```bash
git fetch origin
# gałęzie z commitami w oknie, z tym, co DOKŁADAJĄ ponad gałąź bazową
git for-each-ref --sort=-committerdate --format='%(refname:short) %(committerdate:short)' refs/remotes/origin
git log origin/<baza>..origin/<gałąź> --oneline --since="1 day ago"
git diff --stat origin/<baza>...origin/<gałąź>
# otwarte PR-y (jeśli jest GitHub CLI)
gh pr list --state open --json number,title,headRefName,updatedAt
```

Okno szersze na prośbę: `--since="7 days ago"` albo konkretne daty.

## Trzy sposoby wyboru zakresu (bo jeden kłamie)

| sposób | odpowiada na pytanie |
|---|---|
| **gałąź** | co wejdzie na produkcję, gdy ją scalimy |
| **temat / epik** (wspólny prefiks gałęzi albo słowo w commitach) | jaka była intencja |
| **obszar** (katalog, ścieżka klienta z pliku projektu) | co realnie dotknięte, także przez kilka gałęzi |

To są sposoby WYBORU zakresu, nie liczba recenzentów. Recenzentów liczy `osie.mjs` po wyborze.

## Kolejność: ryzyko x nieosiągalność, nie rozmiar

Trzy linie w ścieżce płatności na niescalonej gałęzi biją dwa tysiące linii dokumentacji.

| znacznik | po czym poznać (heurystyka po ścieżkach plików) | dlaczego podbija |
|---|---|---|
| `PIENIADZE` | payment, checkout, webhook, order, billing, subscription | zapłacił i nie dostał, albo dostał i nie zapłacił |
| `DOSTEP` | auth, login, session, token, middleware, permission | cudza tożsamość albo zamknięty opłacony produkt |
| `MIGRACJA` | katalog migracji bazy | jedyna rzecz, której nie cofa się pushem |
| `DANE-KLIENTA` | email, mail, notification, export, analytics | defekt wychodzi na zewnątrz |
| `CI` | `.github/workflows`, konfiguracja potoku | defekt gasi bramki, a zielone zostaje zielone |

Ścieżka klienta z wagą 4-5 w pliku projektu działa jak znacznik. Brak znacznika nie znaczy "bezpieczne", tylko "nie trafiło we wzorzec".

## Format menu

```
Biorę dzisiaj (powiedz »7 dni«, jeśli szerzej).

1. feat/koszyk-rabaty   PIENIADZE  niescalona  +312/-40, 9 plików kodu, ostatni CR: nigdy
2. fix/login-redirect   DOSTEP     PR #41      +18/-6, 2 pliki kodu, ostatni CR: nigdy
3. docs/onboarding      -          scalona     +540/-0, 0 plików kodu  (dokumentacja: bez CR)

Zacząłbym od 1: jedyna dotyka płatności i nie ma recenzji.
```

Nie streszczasz zawartości zmian. Kandydat z zerem plików kodu nie idzie na CR. Status "ostatni CR" bierzesz z rejestru CR (`references/rejestr-i-bramka.md`); brak wiersza = nigdy.

## Po wyborze

Użytkownik odpowiada numerami. Dla każdego zakresu baza i głowa:

| typ | baza...głowa |
|---|---|
| gałąź | `origin/<baza>...origin/<gałąź>` |
| PR | baza PR...głowa PR |
| temat | rodzic najstarszego commitu tematu ... najnowszy |
| obszar | `origin/<baza>...<ref>`, potem `--pliki=` tylko z katalogów obszaru |

**Jeden zakres = osobna rura.** Jeden agent z trzema zakresami rozlewa uwagę i wraca z listą stylistyczną.
