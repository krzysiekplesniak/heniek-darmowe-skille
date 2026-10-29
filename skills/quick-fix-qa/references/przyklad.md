# Przykład: jedna poprawka od briefingu do PR

Zgłoszenie użytkownika: "Na ekranie profilu po kliknięciu Zapisz z pustym e-mailem nic się nie dzieje."

**Faza 0 BRIEFING:**

```
## Profil: brak komunikatu przy pustym e-mailu

### Problem
Użytkownik czyści pole e-mail w profilu i klika Zapisz. Przycisk nie reaguje,
nie ma komunikatu, dane się nie zapisują. Użytkownik nie wie, czy zapis się udał,
i zwykle klika jeszcze kilka razy albo zamyka stronę.

### Rozwiązanie
Pod polem pojawia się komunikat "Podaj adres e-mail", pole dostaje obramowanie błędu,
a fokus wraca na pole. Pozostałe pola zachowują wpisane wartości.
- komunikat znika, gdy użytkownik zacznie pisać
- przycisk nie jest wyłączany (wyłączony przycisk nie mówi, czego brakuje)

### Co konkretnie trzeba zmienić
- `src/components/profile/ProfileForm.tsx:58` - walidacja przed wysłaniem, stan błędu pola
- `src/components/profile/ProfileForm.test.tsx` - test: pusty e-mail -> komunikat, brak wywołania zapisu

### Dalej
kod (najpierw test) -> QA w przeglądarce (375 px) -> recenzja osobnym agentem -> PR; scalasz Ty.
```

**Faza 1 ZAKRES:** jeden komponent i jego test. QA-tak: zmiana widoczna na ekranie profilu.

**Faza 2 KOD:** najpierw test (czerwony na starym kodzie: komunikatu nie ma, zapis był wołany), potem poprawka, testy i typy zielone.

**Faza 3 QA:** build produkcyjny, logowanie kontem testowym, wejście w profil klikając menu, wyczyszczenie pola, klik Zapisz -> komunikat widoczny, fokus na polu, konsola czysta; zrzut przy 375 px; powrót do listy i ponowne wejście: dane bez zmian.

**Faza 4 RAPORT:** 2 pliki, testy 1 nowy + istniejące zielone, typy 0 błędów, QA ze zrzutem. Zadanie zamknięte; zauważone osobno: to samo zachowanie w formularzu adresu (zapisane jako nowe zadanie, nie naprawiane tutaj).

**Faza 5 RECENZJA + PR:** osobny agent recenzuje `BASE_SHA..HEAD_SHA`: brak uwag krytycznych, jedna drobna (nazwa zmiennej) poprawiona. Push, PR "Profil: komunikat przy pustym e-mailu", treść = raport + werdykt. Linia `PR: <url>`. Koniec: scala użytkownik.
