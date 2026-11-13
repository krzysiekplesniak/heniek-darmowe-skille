# Definition of Done — faza 0.5 (przed kodem, po briefingu)

Sześć warunków. Każdy dostaje ✅ / ⚠️ / **N/D z powodem** — „nie wiem" nie jest odpowiedzią.
Wypełniasz **zanim** zaczniesz, nie po fakcie.

| # | warunek | co znaczy |
|---|---|---|
| **1** | **Adres, nie nazwa** | wskaż konkret: plik, funkcja, identyfikator, próg, slug, współrzędne. Nie „w silniku planu", tylko konkretny plik, funkcja i wartość progu |
| **2** | **Asercja liczbowa** | wynik ma być LICZBĄ, nie przymiotnikiem. Nie „jest mało kandydatów", tylko „11 dla kategorii A, 7 dla B, 2 dla C" |
| **3** | **Kontrola pozytywna** | zmierz RÓWNOLEGLE coś, co MUSI dać inny wynik. Jeśli obie metody dają to samo — twój pomiar nie patrzy tam, gdzie myślisz. Przykład z praktyki: surowa kategoria dawała 8, a funkcja mapująca 11; rozjazd dowiódł, że sonda widzi różnicę między metodami |
| **4** | **Bramka pinuje KLASĘ** | test po naprawie ma łapać rodzinę błędów, nie ten jeden przypadek. N/D dla audytu bez naprawy |
| **5** | **Mierzone na runtime** | plik wygenerowany offline to nie działająca aplikacja. Jeśli mierzysz na artefakcie zamiast na żywym systemie — ⚠️, nie ✅ |
| **6** | **Czerwień-zieleń przez KONTROLĘ NEGATYWNĄ** | nie sama deklaracja, tylko czterokrokowa procedura z `kontrola-negatywna.md`. Bramka, której nie widziałeś na czerwono, nie jest bramką |

⭐ **Adaptacja jest dozwolona i ma być JAWNA.** Zadanie audytowe nie ma czego cofać — warunki 4 i 6 dostają **N/D z jednozdaniowym powodem**. Zakazane jest ciche pomijanie.

Ciche pominięcie warunku jest cięższym błędem niż napisanie N/D.
