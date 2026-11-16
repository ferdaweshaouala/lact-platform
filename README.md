# DTMS — Digital Training Management System

A full-stack web platform for managing training center operations. Handles student records, course scheduling, attendance, gradebooks, analytics, and dropout risk prediction — all in one place, accessible by role.

**Stack:** FastAPI · Next.js 14 · PostgreSQL 15 · Docker Compose

---

## Prerequisites

Install **Docker Desktop** — that is the only requirement.
Everything else (Python, Node.js, PostgreSQL) runs inside Docker.

- [Download Docker Desktop](https://www.docker.com/products/docker-desktop/)
- Make sure Docker Desktop is **running** before you start.

---

## Setup

### 1. Clone the repo

```bash
git clone https://github.com/Elaa2002/DTMS_Private.git
cd DTMS_Private
```

### 2. Create your environment file

```bash
cp backend/.env.example backend/.env
```

Open `backend/.env` and fill in:

```env
# Database (leave as-is if running locally)
DATABASE_URL=postgresql://dtms_user:dtms_pass@db:5432/dtms_db

# Change this to any long random string — used to sign JWT tokens
SECRET_KEY=replace-this-with-something-long-and-random

ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=15
REFRESH_TOKEN_EXPIRE_DAYS=7

# First admin account — created automatically on first startup
FIRST_ADMIN_EMAIL=admin@dtms.com
FIRST_ADMIN_PASSWORD=ChangeMe123!
FIRST_ADMIN_FIRST_NAME=Admin
FIRST_ADMIN_LAST_NAME=DTMS

FRONTEND_URL=http://localhost:3000
COOKIE_SECURE=False

# Optional — needed for invite emails, password resets, and inactivity digests
# If left empty, the app still works; it just won't send any emails
SMTP_USER=
SMTP_PASSWORD=
```

> ⚠️ Never commit `.env` to git. It is already in `.gitignore`.

### 3. Start the platform

```bash
docker-compose up --build
```

The first build takes a few minutes. After that, starts are fast.
The stack is ready when all containers show as healthy:

```bash
docker-compose ps
```

### 4. Open the app

| URL | What it is |
|-----|------------|
| http://localhost:3000 | The web app — open this in your browser |
| http://localhost:8000/docs | Auto-generated API documentation (Swagger UI) |

Log in with the `FIRST_ADMIN_EMAIL` and `FIRST_ADMIN_PASSWORD` from your `.env`.

On first startup, the backend automatically creates this admin account if no users exist yet. Once logged in, you can invite other staff from the admin dashboard — no one self-registers.

### 5. Stop the platform

```bash
docker-compose down
```

Data is preserved in a Docker volume. To wipe everything including the database:

```bash
docker-compose down -v
```

---

## Roles

| Role | What they can do |
|------|-----------------|
| **Admin** | Manage users, view all dashboards, analytics, reports |
| **Supervisor** | Import students, manage courses and enrollments, gradebook oversight, view dropout risk per course |
| **Teacher** | Their assigned courses only — attendance, grades, dropout risk per student, homework review |

---

## Email (optional)

DTMS sends three types of emails:
- **Staff invite** — when an admin creates a new user account
- **Password reset** — when a user clicks "Forgot password"
- **Weekly inactivity digest** — sent to supervisors every Monday at 8:00 AM listing students with no grade activity in the past 7 days

Email uses **Gmail SMTP**. To enable it, set `SMTP_USER` and `SMTP_PASSWORD` in `backend/.env`. The password must be a [Gmail App Password](https://myaccount.google.com/apppasswords) (not your regular Gmail password — requires 2FA on the Gmail account).

If `SMTP_USER` is empty, the app runs normally and silently skips all email sends.

After changing SMTP settings, restart the backend:

```bash
docker-compose restart backend
```

---

## Background Jobs

Three jobs run automatically — no action needed:

| Job | Schedule | What it does |
|-----|----------|-------------|
| Inactivity digest | Every Monday at 08:00 | Emails each supervisor a list of students with no grade activity in 7+ days |
| Token cleanup | Every Monday at 08:05 | Deletes expired and revoked refresh tokens from the database |
| Auto-close courses | Every night at 01:00 | Sets a course to Inactive when its end date has passed and all students are done |

---

## ML Dropout Prediction

The dropout risk model is not trained automatically. Run it manually after the platform has collected real student data (at least a few weeks of live usage):

```bash
docker exec -it dtms_backend python -m app.ml.train
```

This trains on current enrollment data in the database and saves the model to `backend/app/ml/outputs/best_model.joblib`.

Once trained, risk scores appear automatically in the teacher and supervisor dashboards — no restart needed.

The model uses 14 behavioral features per student (attendance rate, grade trend, submission rate, etc.) and outputs a probability score with a SHAP explanation showing which factors contributed most.

---

## Running Tests

```bash
docker exec -it dtms_backend pytest tests/ -v
```

Tests run against an in-memory SQLite database — isolated from your real data.

---

## Optional: Database Admin UI

pgAdmin is included but off by default to save memory. To start it:

```bash
docker-compose --profile tools up --build
```

Open http://localhost:5050

- Login: `admin@dtms.com` / `admin123`
- Add server: host `db`, port `5432`, user `dtms_user`, password `dtms_pass`, database `dtms_db`

---

## Pulling Updates

```bash
git pull
docker-compose up --build
```

Database migrations run automatically on startup.

---

## Project Structure

```
dtms/
├── backend/
│   ├── app/
│   │   ├── core/         # Config, JWT auth, email, scheduler, rate limiting
│   │   ├── models/       # SQLAlchemy ORM models
│   │   ├── routes/       # API endpoints (17 modules)
│   │   ├── schemas/      # Pydantic request/response validation
│   │   ├── services/     # Business logic
│   │   └── ml/           # Dropout prediction pipeline
│   ├── alembic/          # Database migrations (25 versions, auto-applied on startup)
│   ├── tests/            # pytest test suite
│   ├── .env.example      # Copy to .env and fill in your values
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── app/          # Next.js App Router pages
│   │   ├── components/   # Shared UI components
│   │   ├── contexts/     # Auth and theme
│   │   └── lib/          # API client, i18n (English / French / Arabic)
│   └── Dockerfile
├── docker-compose.yml
├── README.md
└── RUNBOOK.md            # Operational guide for maintenance and troubleshooting
```

---

## Troubleshooting

**Container not starting / restarting in a loop:**
```bash
docker-compose logs backend --tail 50
docker-compose logs frontend --tail 50
```

**Port already in use:**
Something else is using port 3000, 8000, or 5432. Stop it or change the conflicting port in `docker-compose.yml`.

**Frontend stuck loading after startup:**
The frontend waits for the backend health check to pass. Give it 30–60 seconds after `docker-compose up` before opening the browser.

**On Apple Silicon (M1/M2) — "exec format error":**
Add `platform: linux/amd64` under both the `backend` and `frontend` services in `docker-compose.yml`.

For more detailed operational procedures (backups, restores, password resets, disk cleanup), see [RUNBOOK.md](./RUNBOOK.md).
