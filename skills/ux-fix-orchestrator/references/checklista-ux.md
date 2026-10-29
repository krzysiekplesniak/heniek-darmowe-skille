# Checklista UX/UI (wbudowana, bez zewnętrznych skilli)

Ogólne progi i dobre praktyki (WCAG 2.2 i powszechne wytyczne platform). Gdy projekt ma własny kanon, ten plik jest drugim źródłem; w konflikcie rozstrzyga werdykt z fazy 1.

## Dostępność i dotyk

- Cel dotyku co najmniej 44 x 44 px, odstęp między celami co najmniej 8 px.
- Kontrast tekstu do 18 px (14 px pogrubiony): co najmniej 4,5:1. Duży tekst i elementy UI (obramowania pól, ikony znaczące, fokus): co najmniej 3:1.
- Fokus widoczny na każdym elemencie interaktywnym, inny kolor niż sam element.
- Elementy klikalne to `button` / `a` z dostępną nazwą, nie `div` z `onClick`.
- Obrazy znaczące mają tekst alternatywny; dekoracyjne pusty `alt`.
- Ruch: szanuj `prefers-reduced-motion`; informacja nie może żyć tylko w animacji.
- Formularz: etykieta przy każdym polu (nie sam placeholder), komunikat błędu przy polu, fokus na pierwsze błędne pole po wysłaniu.

## Układ i typografia

- Szerokość 375 px bez przewijania w poziomie; długie słowa i kwoty się zawijają albo przycinają z wielokropkiem.
- Odstępy na siatce 4/8 px, z tokenów.
- Skala typografii z tokenów; długość linii tekstu ciągłego 45-75 znaków.
- Hierarchia rozmiarem, grubością, odstępem i kontrastem, nie samym kolorem.
- Liczby, ceny, godziny: cyfry tabelaryczne (`font-variant-numeric: tabular-nums`).
- Tekst na zdjęciu: przyciemnienie lub gradient pod tekstem.

## Spójność

- Jeden komponent na jeden wzorzec (przycisk główny, karta, chip); zero przepisanych klas.
- Jedna skala cieni, jedna skala promieni, jedna grubość obrysu ikon.
- Warstwy (z-index) z tokenów, z zarezerwowanymi poziomami dla nagłówka, okien i powiadomień.

## Stany

- Każdy ekran danych ma stan: ładowania, pusty, błędu (z wyjściem dla użytkownika), sukcesu.
- Przycisk wysyłki: stan trwania, potem sukces albo błąd; podwójny klik nie wysyła dwa razy.
- Przycisk wyłączony mówi, czego brakuje (albo nie jest wyłączany, a walidacja mówi przy polu).

## Tekst

- Odmiana liczebnika (po polsku trzy formy: 1 miejsce, 2 miejsca, 5 miejsc).
- Komunikaty błędów mówią, co zrobić, nie tylko, co się stało.
