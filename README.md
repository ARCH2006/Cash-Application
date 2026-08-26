# Cash Application Cockpit — Split Backend/Frontend

Same O2C cash-application app as before, now genuinely split:

- **`backend/`** — an Express API. Holds the data, runs the matching engine, enforces every business rule. This is the only place a decision is ever made.
- **`frontend/`** — a React app with **zero business logic**. It calls the backend's API and renders whatever comes back. It cannot post a match, reject a match, or decide anything on its own.

If you swapped the frontend for a totally different UI (a mobile app, a plain HTML page), the backend wouldn't need to change at all — that's the actual point of the split, and it's the same reason real SAP systems separate the backend (S/4HANA) from the apps that sit on top of it (Fiori, mobile).

---

## Run it locally

**Backend:**
```bash
cd backend
npm install
npm start
# runs on http://localhost:4000
```

**Frontend** (in a second terminal):
```bash
cd frontend
npm install
npm run dev
# runs on http://localhost:5173, calls http://localhost:4000 by default
```

Open the frontend URL — it fetches live data from the backend on load.

---

## Deploy it for real (needed for the "Live, stable, shareable URL" score)

1. **Backend first** — push `backend/` to its own GitHub repo (or deploy directly), then deploy to **Render** or **Railway** (both auto-detect Node + Express, give you a URL like `https://cash-app-backend.onrender.com`). Set `PORT` is handled automatically by these hosts.
2. **Frontend second** — copy `.env.example` to `.env` in `frontend/`, set `VITE_API_BASE_URL` to your real backend URL, then deploy `frontend/` to **Vercel** or **Netlify** (`npm run build` produces the deployable folder, or just point Vercel at the repo and it builds automatically).
3. **Test the real URLs** — open the frontend's live URL on your phone in a private/incognito tab. If the queue loads, both pieces are correctly wired.

**Common failure to watch for:** if the frontend loads but shows "Couldn't reach the backend API," it's almost always one of: `VITE_API_BASE_URL` wasn't set before the build, or the backend host is asleep (free tiers on Render can take ~30s to wake up from idle — click around, wait, refresh).

---

## API reference (what the frontend is allowed to ask for)

| Method | Endpoint | What it does |
|---|---|---|
| GET | `/api/invoices` | All open invoices |
| GET | `/api/payments` | All incoming payments |
| GET | `/api/matches` | Every payment + its proposed invoice match, confidence, and status |
| GET | `/api/kpis` | Cash-application rate, DSO before/after, unapplied backlog |
| POST | `/api/matches/:paymentId/post` | Confirms and finalizes a match. **Rejected by the server** (409/422) if the payment has no candidate, is a duplicate, or is already posted |
| POST | `/api/matches/:paymentId/reject` | Sends a payment to manual review |
| POST | `/api/reset` | Clears posted/rejected state, for re-running the demo |

Try `POST /api/matches/PMT-505/post` and then `POST /api/matches/PMT-506/post` (both propose `INV-1004`) — the second call returns a `409 DUPLICATE_CANDIDATE` error. That's the backend enforcing a real business rule server-side, not just hiding a button in the UI — a judge could hit your API directly and it still can't be fooled.

---

## How this maps to the 7 rubric dimensions

| Dimension | Where it lives now |
|---|---|
| **Process Accuracy** | Backend models real O2C objects (Payment, Open Invoice) and exposes them the way a real system would — as an API, not a UI trick |
| **Business Understanding** | `/api/kpis` computes cash-application rate, DSO, and backlog server-side from real data |
| **UI/UX** | Frontend unchanged from before — queue + detail drawer, status colors, empty states, mobile-safe layout — now with loading and error states for when the backend is unreachable |
| **AI Capability** | Confidence-scored matching engine (`matching.js`) — grounded, explainable, lives entirely in the backend |
| **Validation Handling** | Enforced **server-side**: duplicate detection, already-posted checks, missing-candidate checks — can't be bypassed by tampering with the frontend |
| **Deployment** | Two live URLs now instead of one — see deploy steps above; test both independently |
| **Storytelling** | Same 2–3 minute script as before works unchanged — the split is invisible to the demo audience, it's a Q&A/architecture strength to mention, not something to narrate mid-demo |

**One line for Q&A if a judge asks "why did you split this?":** *"So the business rules live in one place a judge could hit directly with an API call and still not bypass — the frontend is just a view on top of a real service, the way SAP's own architecture separates the backend from Fiori apps."*
