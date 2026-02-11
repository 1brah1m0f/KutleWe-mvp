# KutleWe MVP

KutleWe gənclər üçün fürsət bazası + forum platformasının MVP versiyasıdır.

## Texnologiyalar

- Backend: Node.js, Express
- DB: SQLite
- Frontend: Multi-page HTML/CSS/JS
- AI: Chatbot və AI filter (OpenAI API varsa), fallback qayda-məntiqi

## Səhifələr

- `/index.html` - Ana səhifə
- `/opportunities.html` - Fürsətlər + düzgün filtr + AI filtr
- `/forum.html` - Thread siyahısı + yeni thread formu
- `/thread.html?id=...` - Hər başlıq üçün ayrıca səhifə + cavab formu
- `/about.html` - Platforma haqqında

## Quraşdırma

```bash
npm install
```

İstəyə görə `.env` faylı yaradın:

```env
PORT=3000
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4.1-mini
```

## İşə salma

```bash
npm start
```

Server qalxanda:

```text
http://localhost:3000
```

DB avtomatik yaradılır: `data/kutlewe.db`

## DB strukturu

Əsas cədvəllər:

- `opportunities`
- `threads`
- `thread_replies`

Seed data avtomatik əlavə olunur.
