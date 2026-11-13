# Co ta metoda realnie wykryła (przykłady, bez danych projektu)

**Obaliła cudzą diagnozę.** Wpis w backlogu twierdził „luka danych — nie ma kandydata". Pomiar: jedenaście kandydatów w jednej kategorii, siedem w drugiej, dwa (nie zero) w trzeciej. Zdanie w rejestrze było fałszywe.

**Przesunęła podejrzenie z danych na kod.** Skoro pula jest bogata, a wynik i tak się rozjeżdża — winny jest przetwarzający kod, nie brak danych. To zmienia całą kolejną naprawę.

**Nazwała blocker ważniejszy od zadania.** Dysk był pełny, więc tworzenie worktree padło w połowie. Raport postawił to na początku, nad treścią zlecenia.

**Recenzent złapał to, czego autor nie widział.** Przy wypchnięciu poprawki recenzent przeliczył liczbę wywołań podaną w opisie commita i znalazł więcej miejsc, niż obiecywał autor. Przepisanie liczby z opisu zamknęłoby temat bez sprawdzenia.

**Kontrola pozytywna obaliła pozornie oczywistą poprawkę.** Zmiana domyślnej wartości wyglądała na wstecznie zgodną, ale na prawdziwej funkcji zmieniała zachowanie w dużej grupie przypadków. Cicha regresja została zatrzymana przez DoD, nie przez recenzenta.
