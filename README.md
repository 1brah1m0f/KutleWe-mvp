# KutleWe Backend (Express + Supabase Postgres)

Bu repo `Node.js + Express + pg` minimal backend kimi quruldu.

## 1) Secrets qaydasi

- Secrets GitHub-a push olunmamalidir.
- `.gitignore` qaydasi:
  - `.env`
  - `.env.*`
  - `!.env.example`
- Repo-da yalniz `.env.example` qalir.

## 2) Supabase `DATABASE_URL` hardan goturulur

Supabase dashboard:

`Project Settings -> Database -> Connection string -> URI`

Oradaki URI-ni `.env` daxilinde `DATABASE_URL=` kimi saxlayin.

## 3) ENV listesi

`.env.example`:

```env
PORT=3000
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4.1-mini
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=
SMTP_PASS=
SMTP_FROM=
ADMIN_EMAIL=
ADMIN_ACCESS_CODE=
SESSION_TTL_DAYS=7
DATABASE_URL=
```

Sizde istifade olunacaq faktiki `.env` deyerleri:

- `PORT=3000`
- `OPENAI_API_KEY=...`
- `OPENAI_MODEL=gpt-4.1-mini`
- `SMTP_HOST=smtp.gmail.com`
- `SMTP_PORT=587`
- `SMTP_SECURE=false`
- `SMTP_USER=sixiibrahimov217@gmail.com`
- `SMTP_PASS=(Gmail App Password)`
- `SMTP_FROM="Kutlevi <sixiibrahimov217@gmail.com>"`
- `ADMIN_EMAIL=admin@kutlewe.az`
- `ADMIN_ACCESS_CODE=(random secure string)`
- `SESSION_TTL_DAYS=7`
- `DATABASE_URL=postgresql://...`

## 4) Minimal backend endpointleri

Kod fayllari:

- `db.js`
- `server.js`

Endpointler:

- `GET /health` -> `{ ok: true }`
- `GET /db-test` -> `select now()` neticesini qaytarir
- `POST /chat` -> `body: { message: string }`, OpenAI API cavabi
- `POST /smtp-test` -> (istəyə bağlı) test email gonderimi

OpenAI SDK istifadesi (`server.js` daxilinde):

```js
const OpenAI = require("openai");
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const completion = await openai.chat.completions.create({
  model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
  messages: [{ role: "user", content: message }]
});
```

## 5) DB schema (Supabase SQL Editor)

`supabase/schema.sql` faylini SQL Editor-da run edin.

Tablolar:

- `users(id, email unique, password_hash, created_at)`
- `logs(id, user_id FK, level, message, meta jsonb, created_at, index created_at)`

## 6) Deployment arxitekturasi

### A) Frontend Vercel + Backend Render + DB Supabase (TOVSIYE)

1. Backend-i Render Web Service kimi deploy edin.
   - Build command: `npm i`
   - Start command: `npm start` (ve ya `node server.js`)
2. Render Env Vars:
   - `DATABASE_URL`
   - `OPENAI_API_KEY`
   - `OPENAI_MODEL`
   - `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`
   - `ADMIN_EMAIL`, `ADMIN_ACCESS_CODE`
   - `SESSION_TTL_DAYS`
3. Frontend-i Vercel-de deploy edin (ayri repo/qovluq ola biler).
4. Frontend API base URL env:
   - `NEXT_PUBLIC_API_URL` (Next.js)
   - ve ya `VITE_API_URL` (Vite)

### B) VPS + Docker Compose (nginx + app + db) (ALTERNATIV)

- 1 VPS uzerinde nginx reverse proxy, app container ve db container.
- Bu variant daha cox infra idaresi teleb edir.

## 7) Domain / DNS

### Vercel (frontend)

- `A @ -> 76.76.21.21`
- `CNAME www -> cname.vercel-dns.com`

Vercel:

- `Project Settings -> Domains`
  - `kutlewe.az`
  - `www.kutlewe.az`

### Render (backend)

- Subdomain:
  - `api -> CNAME` Render-in verdiyi hostname-e
- Render:
  - `Custom Domains -> api.kutlewe.az`

## 8) Tehlukesizlik checklist

- OpenAI key rotate/revoke edin (kompromiz varsa derhal).
- Supabase client istifade olunarsa RLS/policies mutleq aktiv edin.
- `ADMIN_ACCESS_CODE` guclu random string olsun.
- Admin endpointlerine rate limiting ve ya basic auth elave edin.

## 9) Meqsed yoxlama addimlari

### Local test

1. `npm install`
2. `.env` duzeldin
3. `npm start`
4. Test:
   - `GET http://localhost:3000/health`
   - `GET http://localhost:3000/db-test`
   - `POST http://localhost:3000/chat` (`{"message":"Salam"}`)
5. SMTP test (istəyə bağlı):
   - `POST http://localhost:3000/smtp-test` (`{"to":"...@gmail.com"}`)

### Prod test

1. `https://api.kutlewe.az/health`
2. `https://api.kutlewe.az/db-test`
3. `POST https://api.kutlewe.az/chat`
4. (istəyə bağlı) `POST https://api.kutlewe.az/smtp-test`
