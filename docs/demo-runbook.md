# Demo runbook — Windows showcase PC

Setting up a machine so the app can be demonstrated **with no internet**, and a
pre-flight checklist for the day.

Two rules behind everything here:

1. **Never install anything in front of judges.** Everything below happens days
   in advance, on the actual machine you will present from.
2. **Reboot once after installing and re-run the checks.** Many school PCs
   restore to a clean image on restart (Deep Freeze / Faronics). If that is on,
   every step below evaporates and you must instead run from a USB drive or your
   own laptop. Find out now, not on the day.

---

## What works offline, and what does not

| Surface | Needs internet? | Why |
| --- | --- | --- |
| **`/learn` (coached solve)** | **No** | The engine runs locally and no model is called anywhere in the coaching loop |
| Worksheet generation | **Yes** | Gemini for Thai phrasing, Supabase for auth/persistence, Inngest for the job |
| Library / login | Yes | Supabase is a cloud service unless you run the local Docker stack |

So `/learn` is the demo that cannot be broken by venue wifi — and it happens to
be the purest demonstration of the architecture, because the engine computes and
grades while no model is involved at all.

Plan the demo around `/learn`. Treat worksheet generation as the part you show
*if* the network holds.

---

## 1. Prerequisites

Install as administrator, then reboot before continuing.

- **Python 3.11+** — <https://python.org>. Tick **“Add python.exe to PATH”** during install.
- **Node.js 22+** — <https://nodejs.org> (LTS).
- **Git** — <https://git-scm.com>.

Verify in a new PowerShell window:

```powershell
py --version      # Python 3.11.x or newer
node --version    # v22.x or newer
git --version
```

If `py` is not recognised, PATH was not set — re-run the Python installer and
choose *Modify → Add to PATH*.

---

## 2. Get both repositories

The app and the engine are separate projects. You need both.

```powershell
cd C:\jotelab
git clone https://github.com/Jotelab/physics-jotelab.git
git clone https://github.com/Jotelab/jotelab-ai.git
```

Check out the branch that has the current work:

```powershell
cd C:\jotelab\physics-jotelab
git checkout local-testing
```

> If `local-testing` is not on GitHub yet, push it from the development machine
> first (`git push -u origin local-testing`), or copy the folder across by USB.

---

## 3. The symbolic engine

```powershell
cd C:\jotelab\jotelab-ai
py -m venv .venv
.venv\Scripts\pip.exe install -r requirements.txt
```

Start it (call the executable directly — this avoids PowerShell's script
execution policy blocking `Activate.ps1`):

```powershell
$env:ENGINE_API_KEY = "dev-secret"
.venv\Scripts\uvicorn.exe service.app:app --port 8000
```

**Verify** in a second window:

```powershell
curl.exe -s http://127.0.0.1:8000/health
```

Expect `{"status":"ok","topics":[...]}` listing **11 topics**. Anything else and
the app will fail closed — fix this before continuing.

---

## 4. The web app

```powershell
cd C:\jotelab\physics-jotelab
npm install
```

Create `.env.local` in that folder:

```
ENGINE_BASE_URL=http://127.0.0.1:8000
ENGINE_API_KEY=dev-secret

# Placeholders. /learn needs these variables to EXIST, but never contacts them.
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=placeholder-anon-key
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

Do **not** add `E2E_STUB_GENERATION`, `DEV_PASSWORD_LOGIN`, or
`GENERATION_MODE=llm_only`. Those make the app serve content that is not
engine-generated, and the server will say so at startup.

```powershell
npm run dev
```

**Verify:** the startup output contains **no** `⚠ Jotelab demo mode is active`
block. If it does, read which flag it names and remove it from `.env.local`.

Open <http://localhost:3000/learn> — you should get a Thai SUVAT problem and the
three solve steps, not the “ยังเชื่อมต่อเอนจินไม่ได้” box.

---

## 5. The test that actually matters

Do this once, deliberately:

1. **Disconnect the network** — unplug the cable, turn off wifi.
2. Reload `/learn`.
3. Solve a problem end to end, then press **ฝึกต่อ** for the next one.

Everything must still work. If it does, venue wifi can no longer ruin your
demonstration. If it does not, something is reaching the internet that
shouldn't — check `.env.local` for a real Supabase URL.

---

## 6. Keeping the engine running

For a demo you can simply start it beforehand. To survive a reboot, use Task
Scheduler.

Save as `C:\jotelab\start-engine.bat`:

```bat
@echo off
cd /d C:\jotelab\jotelab-ai
set ENGINE_API_KEY=dev-secret
.venv\Scripts\uvicorn.exe service.app:app --port 8000
```

Then: **Task Scheduler → Create Task**

- *General* → “Run whether user is logged on or not”
- *Triggers* → New → **At log on**
- *Actions* → New → Start a program → `C:\jotelab\start-engine.bat`
- *Settings* → tick **“If the task fails, restart every 1 minute”**

Verify by rebooting and running the `/health` check again without starting
anything by hand.

---

## 7. Pre-flight checklist — demo day

Run these in order, at least thirty minutes before you present.

| # | Command / action | Expected |
| --- | --- | --- |
| 1 | `curl.exe -s http://127.0.0.1:8000/health` | `"status":"ok"` and 11 topics |
| 2 | `npm run dev` | **no** demo-mode warning block |
| 3 | Open `/learn` | a Thai problem renders |
| 4 | Solve one problem, press **ฝึกต่อ** | a new problem appears |
| 5 | Disconnect network, reload `/learn` | still works |
| 6 | Reconnect, open `/generate` | worksheet flow available if online |

If step 1 fails, nothing else will work — start the engine first.
If step 2 shows a warning, you are about to demo content that is not
engine-generated. Stop and fix `.env.local`.

**Have a screen recording of the full flow as a last resort.** Hardware fails.

---

## 8. One command worth showing them

```powershell
curl.exe -s http://127.0.0.1:8000/health
```

Showing a live service listing its eleven topics takes four seconds and is more
convincing than any slide claiming the engine exists.
