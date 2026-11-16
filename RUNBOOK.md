# DTMS Runbook

Operational guide for keeping DTMS running after the original developer hands it off. Read this front-to-back before you make changes. Every command assumes you're in the project root: `dtms_v2/dtms`.

---

## 1. What's in here

DTMS runs as 4 Docker containers managed by `docker-compose.yml`:

| Container | What it does | Port |
|---|---|---|
| `dtms_db` | PostgreSQL 15 — all data lives here | 5432 |
| `dtms_backend` | FastAPI app (Python) — the API + scheduled jobs | 8000 |
| `dtms_frontend` | Next.js 14 app — the UI users open in a browser | 3000 |
| `dtms_pgadmin` | Optional web UI for the DB | 5050 |

Source code: `backend/` (Python) and `frontend/` (TypeScript). Database migrations: `backend/alembic/versions/`.

---

## 2. Daily checks

Once a week, run:

```bash
docker compose ps
```

Every container should show `Up` and `(healthy)`. If any show `Restarting` or `Exited`, jump to **Section 8 — App is down**.

---

## 3. How to add a new user

Users are created by an admin. There's no public sign-up.

1. Log in as admin (default account: see `backend/.env` → `FIRST_ADMIN_EMAIL`).
2. Go to **Users** → `+ New User`.
3. Fill in name, email, role (admin / supervisor / teacher).
4. Click **Create & Send Invite** — the user gets an email with a link to set their password.

If they don't get the email: SMTP isn't configured (see **Section 7**) or the email went to spam.

---

## 4. How to reset a password

Two ways:

**User self-service:** they go to the login page → "Forgot password?" → enter their email → click the link in the reset email.

**Admin override:** Users page → row menu → **Reset Password**. This sends them a fresh reset link.

If neither works (SMTP broken), an admin can reset directly in the DB:

```bash
docker compose exec backend python -c "
from app.db.database import SessionLocal
from app.models.user import User
from app.core.security import hash_password
db = SessionLocal()
u = db.query(User).filter(User.email == 'their-email@example.com').first()
u.password_hash = hash_password('new_temp_password')
db.commit()
print('Password reset.')
"
```

Tell them the temp password verbally, then make them change it on first login.

---

## 5. How to back up the database

Run from the host (not inside a container):

```bash
docker compose exec -T db pg_dump -U dtms_user -d dtms_db > backup_$(date +%Y%m%d).sql
```

This produces a single `.sql` file. Store it somewhere off the server (Google Drive, an external disk, etc.). **Do this weekly at minimum.** Daily is better.

To verify a backup works, restore it into a scratch DB before you need it:

```bash
docker compose exec -T db psql -U dtms_user -d postgres -c "CREATE DATABASE dtms_test;"
docker compose exec -T db psql -U dtms_user -d dtms_test < backup_YYYYMMDD.sql
docker compose exec -T db psql -U dtms_user -d dtms_test -c "SELECT COUNT(*) FROM users;"
```

If the count matches production, the backup is valid. Drop the test DB when done:

```bash
docker compose exec -T db psql -U dtms_user -d postgres -c "DROP DATABASE dtms_test;"
```

---

## 6. How to restore from a backup

**Stop the app first** so nothing writes during restore:

```bash
docker compose stop backend frontend
```

Then drop and recreate the database:

```bash
docker compose exec -T db psql -U dtms_user -d postgres -c "DROP DATABASE dtms_db;"
docker compose exec -T db psql -U dtms_user -d postgres -c "CREATE DATABASE dtms_db;"
docker compose exec -T db psql -U dtms_user -d dtms_db < backup_YYYYMMDD.sql
docker compose start backend frontend
```

Watch the backend logs for any migration errors:

```bash
docker compose logs backend --tail 50
```

---

## 7. How to redeploy after a code change

```bash
git pull                                              # if code is in git
docker compose up -d --build backend frontend         # rebuild only what changed
docker compose exec backend alembic upgrade head      # apply any new migrations
docker compose logs backend --tail 30                 # confirm clean startup
```

The frontend rebuild takes 1–2 minutes. The backend rebuild is faster. Users currently logged in stay logged in — their JWT cookie is still valid.

If you only changed the frontend:

```bash
docker compose up -d --build frontend
```

If you only changed the backend:

```bash
docker compose up -d --build backend
docker compose exec backend alembic upgrade head    # only if you added a migration
```

---

## 8. Email / SMTP setup

DTMS uses Gmail SMTP for invites, password resets, and the weekly inactivity digest. Credentials live in `backend/.env`:

```
SMTP_USER=youraccount@gmail.com
SMTP_PASSWORD=your_gmail_app_password
```

**Important:** the password is a [Gmail App Password](https://myaccount.google.com/apppasswords), not your regular Gmail password. App passwords require 2FA on the Gmail account.

If `SMTP_USER` or `SMTP_PASSWORD` is empty, the app silently sends no emails. That's by design — it never crashes if email is broken.

After changing the values, restart the backend:

```bash
docker compose restart backend
```

---

## 9. App is down — what to do

**Step 1.** Confirm what's down:

```bash
docker compose ps
```

**Step 2.** Look at the logs of whatever container isn't healthy:

```bash
docker compose logs backend --tail 100
docker compose logs frontend --tail 100
docker compose logs db --tail 100
```

**Common causes and fixes:**

| Symptom in logs | Likely cause | Fix |
|---|---|---|
| `connection refused` to postgres | DB container not up yet | `docker compose start db`, wait 10s, then start backend |
| `alembic.util.exc.CommandError` | A migration failed | Read the error. May need to `docker compose exec db psql -U dtms_user -d dtms_db` and inspect manually |
| Frontend builds forever | npm registry slow/blocked | Wait, or rebuild with `--no-cache` |
| Backend restarts every few seconds | Crash on startup | Logs will show the Python traceback. Most often a missing env var or DB schema mismatch |
| Containers stuck in "Created" status | Docker Desktop hung | Restart Docker Desktop, then `docker compose up -d` |
| Out of disk space | Docker logs/images filled the disk | `docker system prune -a` (warning: removes unused images) |

**Step 3.** Nuclear option — if nothing else works and you have a recent backup:

```bash
docker compose down                          # stop everything
docker compose up -d db                      # bring DB back up
# follow Section 6 to restore the backup
docker compose up -d                         # bring everything else up
```

---

## 10. Cleaning up disk usage

Old Docker images and containers can fill the disk over months:

```bash
docker system df                # see what's using space
docker system prune -a          # delete unused images, containers, networks (asks first)
docker volume prune             # delete unused volumes (the DB volume is in-use, won't be deleted)
```

Don't delete the volume that backs `dtms_db` — that's your data. To check which one it is:

```bash
docker compose ps -q db | xargs docker inspect --format '{{ range .Mounts }}{{ .Source }}{{ end }}'
```

---

## 11. Critical files — DO NOT lose

| File | Why it matters |
|---|---|
| `backend/.env` | Contains DB password, JWT secret, SMTP credentials. Losing this means re-issuing all of them. |
| `backend/alembic/versions/*.py` | Schema history. The DB can't be rebuilt without these. |
| `docker-compose.yml` | Defines the whole stack. |
| Latest DB backup (`backup_*.sql`) | Self-explanatory. |

Keep a copy of `backend/.env` in a password manager. Commit everything else to git.

---

## 12. Where to look when something is weird

- **API is misbehaving:** open `http://localhost:8000/docs` in a browser — it's auto-generated API docs. Try the endpoint directly to see the raw response.
- **Audit trail:** `SELECT * FROM status_change_log ORDER BY changed_at DESC LIMIT 50;` — every status change ever. Can't be deleted by the app (Section 13).
- **Scheduled jobs:** look for `[scheduler]` lines in backend logs. The two recurring jobs are daily Google Sheets sync (3 AM) and weekly inactivity digest (Mondays 8 AM).

---

## 13. Things you should never do

- **Don't `DROP TABLE`** anything. If you absolutely must, take a backup first.
- **Don't run `git push --force`** on the main branch. It rewrites history and is hard to recover from.
- **Don't change `backend/.env` JWT_SECRET in production** — every existing session becomes invalid and everyone has to log in again.
- **Don't grant `UPDATE` or `DELETE` on `status_change_log`** to `dtms_user`. Migration 006 explicitly revokes these to make the audit trail tamper-evident.
- **Don't commit `.env` files to git.** Check `.gitignore`.

---

## 14. Who to call

- **Original developer:** ella.marco.tn@gmail.com
- **Anything Docker-related:** check Docker Desktop logs (right-click tray icon → Troubleshoot)
- **Database recovery:** PostgreSQL docs at https://www.postgresql.org/docs/15/backup.html
