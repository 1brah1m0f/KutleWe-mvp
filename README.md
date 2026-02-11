# KutleWe MVP

KutleWe genceler ucun sade interface-li platformadir:

- Furset bazasi (filter + AI filter)
- Forum (thread + cavab)
- LinkedIn tipli profil sehifesi
- OTP login (email kod)
- Elan paylasimi
- Umumi chat ve qrup chat
- Admin panel (elan tesdiqi)

## Tech stack

- Backend: Node.js + Express
- DB: SQLite (avtomatik yaradilir)
- Frontend: HTML/CSS/JS (multi-page)
- AI: OpenAI API (opsional), fallback qayda mexanizmi

## Isletme

```bash
npm install
npm start
```

Server:

```text
http://localhost:3000
```

## DB avtomatik

Server acilanda `data/kutlewe.db` avtomatik yaranir.
Seed data ve default umumi chat qrupu avtomatik dusur.

## OTP login (Gmail)

`.env` fayli yaradin:

```env
PORT=3000
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4.1-mini

SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your_gmail@gmail.com
SMTP_PASS=your_gmail_app_password
SMTP_FROM=KutleWe <your_gmail@gmail.com>

ADMIN_EMAIL=admin@kutlewe.az
ADMIN_ACCESS_CODE=KutleWeAdmin2026
SESSION_TTL_DAYS=7
```

Qeyd:
- Gmail ucun `SMTP_PASS` adina App Password istifade edin.
- SMTP verilmese kod test rejiminde API cavabinda `debugCode` kimi qayidir.

## Sehifeler

- `/index.html` - Ana sehife
- `/login.html` - OTP login
- `/profile.html` - Profil (LinkedIn tipli)
- `/opportunities.html` - Fursetler
- `/forum.html` - Forum
- `/thread.html?id=...` - Thread detail + cavab formu
- `/community.html` - Elan + umumi chat + qruplar
- `/admin.html` - Admin panel

## Admin demo girisi

- Email: `admin@kutlewe.az`
- Kod: `KutleWeAdmin2026`
