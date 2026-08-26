// server.js
// The "kitchen": this is the ONLY place matching logic and business rules live.
// The frontend never decides anything — it just asks this server and displays the answer.

const express = require("express");
const cors = require("cors");
const { INVOICES, PAYMENTS, buildMatches } = require("./matching");

const app = express();
app.use(cors()); // allows a frontend hosted on a different URL to call this API
app.use(express.json());

// In-memory state — stands in for a real database for the 3-hour build.
// Resets whenever the server restarts. Good enough for a demo, not for production.
const posted = new Set();
const rejected = new Set();

function getLiveMatches() {
  const raw = buildMatches(PAYMENTS, INVOICES);
  return raw.map((m) => {
    if (posted.has(m.payment.id)) return { ...m, status: "posted" };
    if (rejected.has(m.payment.id)) return { ...m, status: "unmatched", candidate: null };
    return m;
  });
}

// --- Read endpoints ---

app.get("/api/invoices", (req, res) => {
  res.json(INVOICES);
});

app.get("/api/payments", (req, res) => {
  res.json(PAYMENTS);
});

// The main endpoint the frontend queue screen calls.
// Returns every payment with its proposed invoice match, confidence, and status.
app.get("/api/matches", (req, res) => {
  res.json(getLiveMatches());
});

// KPI tile numbers, computed server-side so frontend never invents its own math.
app.get("/api/kpis", (req, res) => {
  const matches = getLiveMatches();
  const total = PAYMENTS.length;
  const applied = matches.filter((m) => m.status === "exact" || m.status === "posted").length;
  const backlog = matches
    .filter((m) => m.status === "unmatched" || m.status === "duplicate")
    .reduce((sum, m) => sum + m.payment.amount, 0);

  const cashApplicationRate = Math.round((applied / total) * 100);
  const dsoBefore = 46;
  const dsoAfter = Math.max(28, 46 - Math.round((applied / total) * 20));

  res.json({
    cashApplicationRate,
    unappliedBacklog: backlog,
    dsoBefore,
    dsoAfter,
  });
});

// --- Write endpoints (these enforce the real business rules) ---

app.post("/api/matches/:paymentId/post", (req, res) => {
  const { paymentId } = req.params;
  const payment = PAYMENTS.find((p) => p.id === paymentId);

  if (!payment) {
    return res.status(404).json({ error: "PAYMENT_NOT_FOUND", message: `No payment ${paymentId}.` });
  }
  if (posted.has(paymentId)) {
    return res.status(409).json({ error: "ALREADY_POSTED", message: "This payment is already posted." });
  }

  const match = getLiveMatches().find((m) => m.payment.id === paymentId);

  // Rule 1: you cannot post a payment with no candidate invoice at all.
  if (!match.candidate) {
    return res.status(422).json({
      error: "NO_CANDIDATE",
      message: "No open invoice matches this payment closely enough to post automatically.",
    });
  }

  // Rule 2: you cannot post a duplicate — two payments proposing the same invoice
  // must be resolved by a human before either is finalized, or the invoice gets
  // over-applied.
  if (match.status === "duplicate") {
    return res.status(409).json({
      error: "DUPLICATE_CANDIDATE",
      message: "Another payment also proposes this invoice. Resolve the conflict before posting.",
    });
  }

  posted.add(paymentId);
  res.json({ ok: true, payment: paymentId, invoice: match.candidate.invoice.id });
});

app.post("/api/matches/:paymentId/reject", (req, res) => {
  const { paymentId } = req.params;
  const payment = PAYMENTS.find((p) => p.id === paymentId);

  if (!payment) {
    return res.status(404).json({ error: "PAYMENT_NOT_FOUND", message: `No payment ${paymentId}.` });
  }
  if (posted.has(paymentId)) {
    return res.status(409).json({ error: "ALREADY_POSTED", message: "Cannot reject a payment that's already posted." });
  }

  rejected.add(paymentId);
  res.json({ ok: true, payment: paymentId, status: "sent to manual review" });
});

// Simple reset endpoint — handy to re-demo without restarting the server.
app.post("/api/reset", (req, res) => {
  posted.clear();
  rejected.clear();
  res.json({ ok: true });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Cash Application backend running on http://localhost:${PORT}`);
});
