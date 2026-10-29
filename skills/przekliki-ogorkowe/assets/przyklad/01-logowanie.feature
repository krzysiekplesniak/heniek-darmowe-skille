# language: pl
#
# Przykładowa historia przeklikania. Skopiuj do e2e/przekliki/<obszar>/ i przepisz zdania na swoją aplikację.
# Każde zdanie kroku musi mieć definicję w kroki/*.ts; zdanie bez definicji NIE jest zielone.

@rola:klient
Funkcja: Logowanie i powrót do konta
  Jako klient, który wraca po tygodniu
  chcę zalogować się z telefonu w kilka sekund
  żeby wrócić do swojego zamówienia bez dzwonienia na infolinię.

  Tło:
    Zakładając, że otwieram "/login" na telefonie

  @jest @sciezka:logowanie
  Scenariusz: Poprawne dane prowadzą na pulpit konta
    Kiedy wpisuję "klient.testowy@example.com" w pole "E-mail"
    Oraz wpisuję hasło testowe w pole "Hasło"
    Oraz klikam "Zaloguj"
    Wtedy widzę tekst "Twoje zamówienia"
    Oraz adres strony zawiera "/konto"

  @jest @sciezka:logowanie
  Scenariusz: Złe hasło daje czytelny komunikat, a nie pusty ekran
    Kiedy wpisuję "klient.testowy@example.com" w pole "E-mail"
    Oraz wpisuję "zle-haslo" w pole "Hasło"
    Oraz klikam "Zaloguj"
    Wtedy widzę tekst "Nieprawidłowy e-mail lub hasło"
    Ale nie widzę tekstu "Twoje zamówienia"

  @planowane
  Scenariusz: Link logowania z maila działa na drugim telefonie
    Zakładając, że dostałem link logowania na skrzynkę testową
    Kiedy otwieram ten link na drugim telefonie
    Wtedy widzę tekst "Twoje zamówienia"
