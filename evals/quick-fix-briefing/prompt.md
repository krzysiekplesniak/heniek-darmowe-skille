---
name: quick-fix-briefing
description: Pozytyw - szybka poprawka zaczyna sie od briefingu przed kodem
max_turns: 8
timeout_seconds: 300
---

Szybka poprawka: na ekranie profilu przycisk Zapisz nic nie robi, gdy pole e-mail jest puste - brak komunikatu. Komponent wygląda mniej więcej tak:

```tsx
export function ProfileForm({ onSave }) {
  const [email, setEmail] = useState('');
  function submit(e) { e.preventDefault(); if (!email) return; onSave({ email }); }
  return <form onSubmit={submit}><input value={email} onChange={e => setEmail(e.target.value)} /><button>Zapisz</button></form>;
}
```

Zacznij od tego, co robisz jako pierwsze, i pokaż mi to. Kodu na razie nie zmieniaj.
