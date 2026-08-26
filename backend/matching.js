// matching.js
// This is the "kitchen" logic — the real business rules and the scoring engine.
// Kept deterministic and explainable on purpose: in a live Q&A you can walk a
// judge through exactly how a confidence number was produced.

const INVOICES = [
  { id: "INV-1001", customer: "Acme Corp", amount: 5000, due: "2026-08-10" },
  { id: "INV-1002", customer: "Acme Corp", amount: 3200, due: "2026-08-15" },
  { id: "INV-1003", customer: "Beta Industries", amount: 7800, due: "2026-08-05" },
  { id: "INV-1004", customer: "Gamma LLC", amount: 1500, due: "2026-08-20" },
  { id: "INV-1005", customer: "Delta Co", amount: 4200, due: "2026-08-18" },
  { id: "INV-1006", customer: "Epsilon Ltd", amount: 9100, due: "2026-08-01" },
  { id: "INV-1007", customer: "Beta Industries", amount: 2600, due: "2026-08-22" },
  { id: "INV-1008", customer: "Gamma LLC", amount: 3300, due: "2026-08-25" },
];

const PAYMENTS = [
  { id: "PMT-501", customer: "Acme Corp", amount: 5000, date: "2026-08-09" },
  { id: "PMT-502", customer: "Acme Corporation", amount: 3200, date: "2026-08-14" }, // name typo -> fuzzy
  { id: "PMT-503", customer: "Beta Industries", amount: 7750, date: "2026-08-04" }, // short-pay -> fuzzy
  { id: "PMT-504", customer: "Delta Co", amount: 4200, date: "2026-08-17" },
  { id: "PMT-505", customer: "Gamma LLC", amount: 1500, date: "2026-08-19" },
  { id: "PMT-506", customer: "Gamma LLC", amount: 1500, date: "2026-08-19" }, // duplicate of 505
  { id: "PMT-507", customer: "Zeta Corp", amount: 900, date: "2026-08-21" }, // no matching customer
  { id: "PMT-508", customer: "Epsilon Ltd", amount: 9100, date: "2026-08-02" },
];

function nameSimilarity(a, b) {
  const x = a.toLowerCase().trim();
  const y = b.toLowerCase().trim();
  if (x === y) return 1;
  if (x.includes(y) || y.includes(x)) return 0.9;
  const setX = new Set(x.split(/\s+/));
  const setY = new Set(y.split(/\s+/));
  const overlap = [...setX].filter((t) => setY.has(t)).length;
  return overlap / Math.max(setX.size, setY.size);
}

function amountDelta(a, b) {
  return Math.abs(a - b) / b;
}

// Computes proposed matches for every payment against every open invoice.
// This is pure, stateless scoring logic — no side effects, no data mutation.
function buildMatches(payments, invoices) {
  const invoiceUsage = {};

  const results = payments.map((p) => {
    let best = null;
    for (const inv of invoices) {
      const nameScore = nameSimilarity(p.customer, inv.customer);
      const amtDelta = amountDelta(p.amount, inv.amount);
      if (nameScore < 0.5) continue;
      let confidence = nameScore * 0.6 + Math.max(0, 1 - amtDelta * 20) * 0.4;
      confidence = Math.max(0, Math.min(1, confidence));
      if (!best || confidence > best.confidence) {
        best = { invoice: inv, confidence, nameScore, amtDelta };
      }
    }
    if (!best) return { payment: p, status: "unmatched", candidate: null };

    invoiceUsage[best.invoice.id] = (invoiceUsage[best.invoice.id] || 0) + 1;

    let status = "review";
    if (best.confidence >= 0.98) status = "exact";
    else if (best.confidence >= 0.75) status = "fuzzy";
    else status = "unmatched";

    return { payment: p, status, candidate: best };
  });

  return results.map((r) => {
    if (r.candidate && invoiceUsage[r.candidate.invoice.id] > 1) {
      return { ...r, status: "duplicate" };
    }
    return r;
  });
}

module.exports = { INVOICES, PAYMENTS, buildMatches, nameSimilarity, amountDelta };
