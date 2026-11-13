# Limit rund i luka testowa

## ⛔ Limit rund (kontrakt; bramka pilnuje kolumny Rundy)

Powód reguły: przeglądy szły przez trzy i więcej rund (przegląd → poprawki → przegląd poprawek → …), a kolejne rundy w większości poprawiały skutki poprzednich poprawek. Czas rósł szybciej niż liczba znalezisk. Stąd sztywny limit.

Licznik rund to opcjonalna kolumna `Rundy` w REJESTR-CR. Bramka `cr-bramka-zamkniecia.mjs` (kontrola h) blokuje wartość > 2 bez wpisu wyjątku w tej samej komórce, np. `3 (wyjątek: decyzja właściciela)`. Bez tej kolumny egzekwuje limit ORK ręcznie. Job VPS ma `maxRounds` zgodne z 1+1.

| runda | kiedy | co |
|---|---|---|
| **1 CR + 1 poprawki** | ZAWSZE, każda fala | recenzja po osiach (B), poprawiacze (D), integracja i bramka (E–F) |
| **przeklik/e2e + poprawki** | po 1 CR + 1 poprawki, gdy linia ma przeklik | poprawki z przeklików w tej samej fali |
| **CR końcowe** | ZAWSZE po przekliku i poprawkach, niezależnie od osi (decyzja właściciela 10.11, zmienia zasadę z 16.10) | dokładnie jedno, jeden agent integracyjny na złączonym HEAD, diff-only od SHA pierwszej rundy; znaleziska: 1 runda poprawek, potem bramka z etapu F; w REJESTR-CR wpis `3 (CR końcowe, reguła 10.11)`; `pr --gotowy` dopiero po nim |
| **kolejne rundy** | NIGDY z automatu | znalezisko, które by ją wywołało, idzie na listę pytań (etap G) z rekomendacją; ruszasz dalej tylko na zgodę właściciela; żadnych pętli |

Nowe znalezisko z poprawiacza albo z integracji wraca do C z nowym ID, ale zamyka się w ramach limitu. Poprawiacz w rundzie 1 robi grep rodzeństwa i konsumentów (klasa defektu, nie jedno miejsce), żeby runda 2 nie była potrzebna. Kolejna fala recenzentów dokłada wiersze do tej samej sekcji — PR dalej jest jeden.

## ⛔ Luka testowa

Zasada: znajdujemy błąd, testy tego nie złapały — zapisujemy lukę w tej samej rundzie. Każde znalezisko klasy POPRAWKA dostaje od poprawiacza:

1. **Dowód czerwieni na starym kodzie.** Test albo komenda, która pada na kodzie sprzed poprawki (komunikat nazywa ten defekt), potem poprawka, potem zielone. Wynik wpisany w kolumnę DOWÓD. Test woła prawdziwy kod, nie regex po źródle.
2. **Klasa luki — jedna z pięciu**, wpisana w kolumnę `DOWÓD` albo osobną kolumnę `LUKA` wiersza (`Luka testowa: <klasa>`):
   - `brak testu`
   - `test kształtu zamiast zachowania`
   - `test pominięty albo wyłączony`
   - `test na złej warstwie (test jednostkowy zielony, przeklik by złapał)`
   - `środowisko albo dane testu inne niż produkcja`
3. **Rodzeństwo testów.** Grep testów tego samego modułu na tę samą słabość (ta sama atrapa, ten sam regex po źródle, ten sam `skip`). Słabe testy znalezione przy okazji zapisuje jako osobne ID z klasą POPRAWKA TESTU.

**Kto pisze trwały test.** CR nie pisze testów e2e ani przeklików. Trwały test regresji dla poprawki pisze `test-epiku`, którego autor jest inny niż autor poprawki (zasada: autor testu ≠ autor kodu). Poprawiacz dostarcza tylko dowód czerwieni i kontrolę negatywną. Z CR wychodzi do ORK lista luk (plik, klasa, ścieżka) jako zlecenie dla `test-epiku`.

Nie dopisujemy testów „na zapas" do kodu, w którym przegląd nic nie znalazł. Dla znaleziska ze stanem `PYTANIE Qn` test powstaje dopiero po decyzji. Zliczenie klas luk w opisie PR (np. „z siedemnastu poprawek: dziewięć brak testu, cztery kształt, dwa warstwa") pokazuje, gdzie siatka testów jest dziurawa.

**Rejestr poprawek jest tabelą generowaną, nie pisaną ręcznie.** Źródło prawdy: kolumna `SHA` w wierszu znaleziska. Z niej buduje się: commit → data → pliki → znaleziska (`cr-bramka-zamkniecia.mjs --tabela`). Linkowanie po tekście commita jest zakazane (numeracje się rozjeżdżają).
