# Reguły testów e2e, PR i staging

1. **Test asertuje WYNIK widoczny dla użytkownika, nie kształt źródła.** Dopasowanie
   wyrażeniem regularnym do pliku źródłowego nie jest dowodem, że ekran działa.
2. **PR zmieniający ścieżkę użytkownika w kodzie aplikacji dopisuje albo aktualizuje
   scenariusz e2e** — albo w opisie PR uzasadnia, czemu nie. Kontrolę pokrycia można
   dodać jako ostrzeżenie CI (nie blokadę).
3. **Nowa wartość w unii albo enumie** = przejście po WSZYSTKICH `switch` i mapach
   konsumentów, nie tylko po miejscu, gdzie wartość powstała.
4. **Czerwone CI nie jest „starą czerwienią stagingu".** Nie scalamy przy czerwonym.
5. **Zielony test lokalnie nie dowodzi, że działa w CI** (inny system, kolejność
   testów, zadania w tle z poprzedniego testu). Sprawdź stan checków PR, nie terminal.
6. **PR-y zakładamy jako SZKIC i oznaczamy „gotowy do recenzji" dopiero po skończeniu
   pracy.** Ciężkie przebiegi CI startują zwykle dopiero na gotowym PR, więc kolejne
   pushe do niedokończonego PR nie palą minut. Szkic dostaje jawne ostrzeżenie, że
   przebieg został pominięty — to świadome pominięcie, NIE zielone CI.
7. **Jeden PR = jeden temat = kilka commitów**, nie jeden commit i nie pięć PR-ów
   na jeden temat. Każdy PR kosztuje osobny przebieg CI.
8. **Pełne e2e biegnie w tle** (np. nocą, na stagingu), PR dostaje szybki zestaw.
   E2e na PR tylko na żądanie właściciela.
9. **Staging jest bramą, nie wysypiskiem.** Na staging wchodzi wyłącznie to, co ma
   numer w rejestrze zadań. Zmiana bez numeru nie ma czego przeglądać ani zamykać.

## Poziomy testów przed stagingiem (A / B / C)

Przy wielu małych PR-ach e2e na każdym jest przesadą. Podział:

- **Poziom A — każdy PR:** szybki zestaw projektu (typy, testy jednostkowe, testy
  komponentów, kontrakty), CR (`zakres-cr`) z oceną testu bezpośredniego i kontrolą
  negatywną, poprawki po CR. Test importuje lub renderuje prawdziwy plik, nie czyta
  źródła regexem (reguła 1).
- **Poziom B — tylko PR dotykające pieniędzy, płatności, webhooków, dostępu albo
  odzyskiwania konta:** dodatkowo test integracyjny albo kontraktowy na całej ścieżce
  (handler na realnych danych, bez przeglądarki), z kontrolą negatywną. To nie jest
  pełne e2e i nie wymaga przeglądarki. PR z pieniędzmi lub dostępem bez testu
  poziomu B nie przechodzi CR.
- **Poziom C — po integracji paczki PR-ów na stagingu:** e2e osi, przeklik w
  przeglądarce, audyt; raz dla całej paczki, nocą albo na żądanie.

⚠️ **Do decyzji (ROZBIEZNOSCI.md, D2):** w tej wersji test pisze agent kodujący
razem z kodem (test najpierw). W skillu `quick-fix-qa-plus` obowiązuje zasada
„autor testu różny od autora kodu" (`test-epiku`). Oba zapisy są w materiałach
projektu i wymagają jednej decyzji.
