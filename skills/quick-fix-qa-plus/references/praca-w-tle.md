# Praca w tle — wątek główny przyjmuje, agenci wykonują

Wątek główny nie musi stać zablokowany na jednym zadaniu. Faza 5 (recenzent) z definicji wymaga osobnego agenta z osobnym kontekstem. Ta zasada rozciąga się na CAŁY ciężki, mierzalny fragment metody: odpalasz go jako agenta w tle i w TEJ SAMEJ odpowiedzi wracasz do wątku głównego, który może przyjąć kolejne zlecenie, zamiast czekać bezczynnie.

Gdy zakres jest duży (wiele commitów albo plików), dziel go na partie i odpalaj równolegle, nie sekwencyjnie. Każda partia ma jednego agenta, jasno opisany zakres WEJŚCIA (co sprawdzić) i WYJŚCIA (format raportu). Agent zwraca zwięzłe podsumowanie, nie surowy transkrypt.

| Fragment metody | Delegować? | Dlaczego |
|---|---|---|
| Faza 0.0–0.5 (bramka wejścia, DoD) | **NIE** | Decyzje wymagają osądu i rozmowy z użytkownikiem; agent bez kontekstu zgadywałby |
| Faza 1–3 (kod, jedna zmiana) | **NIE** dla małych zadań; **TAK** przy epiku albo wielu niezależnych naprawach | Jedna spójna zmiana nie zyskuje na podziale; N niezależnych napraw to N agentów |
| Faza 4, warstwy 1–2 (unit, integracyjny) | **CZĘŚCIOWO** | Szybkie, można zrobić samemu; przy wielu niezależnych sondach — równolegle |
| Faza 4, warstwy 3–4 (przeklik, headless) | **TAK, gdy wolne** | Przeglądarka i żądania na żywo zajmują czas rzeczywisty — agent w tle |
| Faza 5 (recenzent) | **TAK, ZAWSZE** | Już wymagane („osobny agent, osobny kontekst") |

Jak to robić:
1. Podziel zakres na rozłączne partie (per commit, per plik, per warstwa dowodu).
2. Odpalaj partie w JEDNEJ odpowiedzi, nie jedna po drugiej.
3. W tej samej odpowiedzi wracaj do wątku głównego albo jawnie powiedz użytkownikowi, na co czekasz i ile agentów pracuje.
4. Po powiadomieniu o zakończeniu zbieraj wynik do zbiorczego raportu; nie czytaj surowego transkryptu agenta (przepełni kontekst).
5. Nigdy nie duplikuj pracy, którą już zlecono agentowi.

⛔ **Czego to NIE zmienia:** DoD (faza 0.5) i decyzje z użytkownikiem zostają w głównym wątku. Delegacja dotyczy WYKONANIA (pomiaru, przeglądu, testu), nie decydowania.
