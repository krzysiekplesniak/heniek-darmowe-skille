# Recenzent przed wyjściem poza komputer — faza 5

Wywołanie: skill **`zakres-cr`** na zakresie zmiany. Ten plik opisuje, czego ta
bramka pilnuje i jak czytać wynik.

**Bramka stoi przy wypchnięciu (gałąź do integracji, PR), NIE przy każdym commicie.**
Przegląd przy każdym commicie to tyle przebiegów, że nikt tego nie utrzyma.

## Co dostaje recenzent

**Diff i nic więcej.** Bez uzasadnienia autora, bez kontekstu rozmowy, bez „chodziło
o to, żeby". Jeśli commit nie tłumaczy się sam — to jest znalezisko.

## Trzy pytania, na które odpowiada

1. **Czy to robi to, co opisuje commit?** Liczby z opisu przelicza, nie przepisuje.
   Przykład: opis mówi „we wszystkich czterech wywołaniach", recenzent liczy — jest ich osiem.
2. **Czy bramka mierzy ZACHOWANIE, czy KSZTAŁT?** Test dopasowujący tekst źródła
   pinuje kształt. Test, który czerwienieje po zepsuciu zachowania, pinuje zachowanie.
3. **Czy nie wraca klasa błędu z kanonu?** Cichy fallback, fail-open zamiast
   fail-closed, bramka regexowa bez obsługi końców linii, pomiar na artefakcie
   zamiast na runtime.

## Słownik odbioru

Każde znalezisko kończy w jednym stanie:

| stan | znaczenie | wymagany dowód |
|---|---|---|
| **NAPRAWIONE** | poprawka wypchnięta w tej samej fali | SHA poprawki |
| **OBALONE** | recenzent sprawdził i zarzut nie zachodzi | komenda albo lektura z numerem linii |
| **CZYSTO** | obszar przejrzany, bez znalezisk | zakres i lista plików |
| **PYTANIE Qn** | wymaga decyzji właściciela | pozycja Qn na liście pytań |

Stanu „wisi", „czeka" ani „do sprawdzenia później" nie ma.

## Metoda recenzenta — czytanie kontradyktoryjne

Recenzent NIE sprawdza, czy commit robi to, co obiecuje. Zakłada, że obietnica jest
fałszywa, i szuka wejścia, przy którym się rozpada. Wymuszasz to trzema regułami
wpisanymi do zlecenia:

1. **Zakaz zgłoszenia bez scenariusza awarii.** Każde znalezisko ma konkretne wejście
   albo stan → co konkretnie pójdzie źle.
2. **Liczby z opisu commita trzeba PRZELICZYĆ, nie przeczytać.**
3. **Lista pułapek projektu na wejściu** — kończenia linii, zmienne środowiskowe,
   fail-open kontra fail-closed, ścieżki nazwane, ale nieczytane w skrypcie
   uruchamianym jako proces potomny — żeby recenzent nie zgłaszał fałszywych porażek.

**Wybiórcza kontrola negatywna** to jedyna część, która jest POMIAREM: tam, gdzie
commit dodawał bramkę, recenzent wprowadza defekt, który bramka ma łapać, uruchamia
ją, potwierdza czerwień z komunikatem nazywającym ten defekt i **cofa zmianę**,
kończąc z czystym statusem. Nie dla wszystkich commitów — tylko tam, gdzie jest co
kontrolować.

## Czego ta metoda NIE daje

⛔ Nie uruchamia produktu. Znajduje defekty w kodzie i w bramkach, nie w zachowaniu.
Znaleziska dzieli się na **zmierzone** i **argumenty z lektury** — i mówi to wprost.
Argument bez pomiaru zostaje argumentem, nawet gdy brzmi przekonująco.

## Dlaczego to NIE zastępuje DoD

|  | recenzent (brama wyjściowa) | DoD, faza 0.5 (brama wejściowa) |
|---|---|---|
| **kiedy** | po napisaniu kodu | **przed** napisaniem |
| **pyta** | „czy to się rozpada?" | „skąd będę wiedział, że naprawiłem?" |
| **kontrola pozytywna** | brak systematycznej | **warunek 3, obowiązkowy** |

Recenzent potrafi zaproponować poprawkę, która wygląda na wstecznie zgodną, a
kontrola pozytywna z DoD pokazuje, że zmienia zachowanie w innym przypadku.
Recenzent i DoD to dwie różne bramki. Żadna nie zastępuje drugiej.

## Dlaczego to nie może być samoocena

Autor i sędzia w jednej osobie nie działa. Recenzenci obalali twierdzenia autora
podane jako fakty, bo brzmiały jak wniosek z pomiaru, a pomiaru nie było. Recenzent
musi być osobnym agentem z osobnym kontekstem.

Tryb harnessu (zlecenie z kopertą i raportem, także na VPS): recenzent dostaje zlecenie w formacie koperty i odsyła raport o tym samym kształcie, co w trybie lokalnym. Format opisuje wtedy skill `paczka-joba`, jeśli masz ten skill. Bez niego recenzent działa lokalnie, tak jak opisano wyżej, i nie potrzebuje żadnego odsyłacza.
