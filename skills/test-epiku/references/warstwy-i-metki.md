# Warstwy testów i metki scenariuszy (szczegóły do SKILL.md)

Ten plik rozwija dwie części rdzenia: które warstwy pisze i uruchamia ten skill, oraz jak pracować z metkami `.feature`. Zasady są w `SKILL.md`; tutaj jest tabela i pełna lista reguł.

## Warstwy testów

| Warstwa | Pisze ten skill | Gdzie biegnie |
|---|---|---|
| Jednostkowa, kontraktowa, integracyjna (bez przeglądarki) | tak | lokalnie, G (komenda z `testy.komenda_jednostkowych` albo z konfiguracji warstw) |
| Przeklik scenariuszowy (`.feature`, składnia i kroki z `przekliki-ogorkowe`) | tak | lokalnie, G; tylko scenariusze dotkniętych ścieżek; tryb ścisły; jeden przebieg naraz, gdy wspólna baza |
| E2E celowane | tak | lokalnie na złączonej głowie, PRZED wypchnięciem. Zmiana w kodzie pieniędzy (płatności, webhooki, zamówienia, uprawnienia) = scenariusz zakupu obowiązkowy |
| Smoke ścieżek krytycznych | nie (w mapie) | G; zawsze, gdy zmiana dotyka pliku wspólnego, pieniędzy, tożsamości, zgody lub cookies |
| Przeklik mieszany, warstwa 1 (bez przeglądarki) | nie, woła `przeklik-mieszany` (jeśli masz ten skill) | G, gdy zmiana dotyka stanu współdzielonego między ekranami |
| Przeklik mieszany, warstwa 2 (przeglądarka) | nie | po scaleniu fali na stagingu; w raporcie `NIESPRAWDZONE, zlecone` |
| Pełne e2e, ciężkie testy, zakup z kuponem, CR wieloosiowy | nie | staging, noc, przycisk |

Smoke ścieżek krytycznych: mapa nie zna zależności pliku wspólnego od ścieżek, które od niego korzystają. Dlatego smoke dokładasz ręcznie, gdy zmiana dotyka pliku wspólnego, pieniędzy, tożsamości, zgody lub cookies (`mapa-testow` robi to sam na poziomie `fala`, chyba że podasz `--bez-smoke`).

## Metki scenariuszy: `@planowane`, potem `@na-galezi`

Decyzja właściciela (03.11): scenariusz przed kodem to plik `.feature` z metką `@planowane`. Silnik klika tylko `@jest` i `@na-galezi`; `@planowane` jest pomijany.

1. W etapie D agent pisze kroki z TEKSTU scenariusza, nie z kodu. Scenariusz, którego zdanie nie ma kroku, nie może mieć metki klikanej.
2. W etapie F ORK zmienia metkę `@planowane` na `@na-galezi` WYŁĄCZNIE po zielonym G (3x solo). To jedna linia metek, bez przepisywania pliku. `walidator-metek.mjs` wymaga dowodu przy każdym awansie (`--dowod-testu=<sha lub plik>`).
3. `@jest` nadaje proces wydania, nie ten skill.
4. Obniżenie stanu (`@jest` -> `@na-galezi`, `@na-galezi` -> `@planowane` itd.), usunięcie metki stanu i usunięcie scenariusza ze stanem to kod 4 walidatora: decyzja właściciela, nie ruch ORK.
5. Klikany scenariusz bez kroków blokuje verify. Czerwony `@na-galezi` z krokami, ale bez kodu, to OCZEKIWANA CZERWIEN: wolno ją mieć w trakcie fali, w rejestrze luk. Bramka H jej nie przepuszcza.
6. Zmienna wyboru `@sciezka:<id>` ZASTĘPUJE listę klikanych metek. Nie używaj jej w tym skillu.
7. Lint (etap E): dokładnie jeden blok Kiedy/Gdy/When; poniżej 10 kroków (tło wliczone); Wtedy sprawdzalne (bez „działa”, „jest ok”, „poprawnie”); w zdaniach bez selektorów CSS, czekań i adresów API. Scenariusz z metką `@podroz` jest zwolniony z reguł 1 i 2, nie z reguł Wtedy i selektorów.

Reguły walidatora metek (kod wyjścia 1, 4, 2):
- (a) wejście w `@jest` lub `@na-galezi` (z `@planowane`, z innego stanu, jako nowy scenariusz) wymaga ważnego dowodu;
- (b) obniżenie stanu, usunięcie metki stanu i usunięcie scenariusza ze stanem = kod 4;
- (c) nowy scenariusz bez metki stanu = 1;
- (d) nowa metka spoza listy dozwolonej (metki stanu, `@podroz`, `@rola:<coś>`) = 1;
- (e) brak gita, zły ref, brak parsera, zła flaga = 2.
Szczegóły skryptu i interpretacje: `references/wymagane-skrypty.md`.
