# Dowód czterowarstwowy — faza 4

Cztery warstwy, od najtańszej do najdroższej. Każda dostaje ✅ albo ⚪ **NIE ZMIERZONO — i wtedy MUSI mieć komendę**, którą ktoś to domierzy.

| # | warstwa | czym jest |
|---|---|---|
| **1** | **UNIT / celowany** | sonda uruchomiona na **PRAWDZIWYCH funkcjach projektu**, importowanych z repo — nie na przepisanej logice. Przepisana logika testuje twoje rozumienie, nie kod |
| **2** | **INTEGRACYJNY** | pełny przebieg realnej ścieżki (cały pipeline albo całe zapytanie) na realnych danych — nie fragment |
| **3** | **PRZEKLIK e2e** | człowiek albo przeglądarka automatyczna przechodzi ekran, na którym to widać |
| **4** | **HEADLESS na środowisku z danymi** | żądanie HTTP na żywy endpoint albo zapytanie do żywej bazy (tylko odczyt). To jedyna warstwa, która mierzy to, co widzi użytkownik |

⛔ **Żelazna zasada tej fazy: warstwa niezmierzona zostaje w tabeli z ⚪ i komendą.** Usunięcie wiersza, żeby tabela ładniej wyglądała, jest cięższym błędem niż samo niezmierzenie. Raport, który zamknął się werdyktem „1/4 warstw", był wartościowy, a nie porażką.

**Werdykt kończący ma dwie liczby, obie jawne:**
- **DoD: N/6** spełnione
- **Dowód: N/4** warstw zmierzonych

Pułapki przy pomiarze (zerowe wyniki, ukryte kopie w DOM, zerowy viewport, świeży katalog roboczy) — `artefakty-pomiaru.md`.
