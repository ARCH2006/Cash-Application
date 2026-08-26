import React, { useState, useEffect, useCallback } from "react";
import { CheckCircle2, AlertTriangle, Inbox, ChevronRight, X, Sparkles, TrendingDown, RotateCcw } from "lucide-react";

// The frontend holds NO business logic — no matching, no scoring, no rules.
// It only calls the backend API and renders whatever comes back. This is the
// core idea of a split architecture: the "dining room" never cooks.

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";

const STATUS_META = {
  exact: { label: "Exact match", color: "#0F7B4A", bg: "#E7F6EE", icon: CheckCircle2 },
  fuzzy: { label: "Needs review", color: "#B45309", bg: "#FEF3E2", icon: AlertTriangle },
  duplicate: { label: "Duplicate — needs review", color: "#B42318", bg: "#FEE4E2", icon: AlertTriangle },
  unmatched: { label: "Unapplied", color: "#5B5F6B", bg: "#F1F2F4", icon: Inbox },
  posted: { label: "Posted", color: "#0F7B4A", bg: "#E7F6EE", icon: CheckCircle2 },
};

export default function App() {
  const [rows, setRows] = useState([]);
  const [kpis, setKpis] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selected, setSelected] = useState(null);
  const [filter, setFilter] = useState("all");
  const [toast, setToast] = useState(null);
  const [actionError, setActionError] = useState(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [matchesRes, kpisRes] = await Promise.all([
        fetch(`${API_BASE}/api/matches`),
        fetch(`${API_BASE}/api/kpis`),
      ]);
      if (!matchesRes.ok || !kpisRes.ok) throw new Error("Backend returned an error.");
      const matches = await matchesRes.json();
      const kpiData = await kpisRes.json();
      setRows(matches);
      setKpis(kpiData);
    } catch (e) {
      setError("Couldn't reach the backend API. Is the server running at " + API_BASE + "?");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function postMatch(paymentId) {
    setActionError(null);
    try {
      const res = await fetch(`${API_BASE}/api/matches/${paymentId}/post`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setActionError(data.message || "Could not post this match.");
        return;
      }
      setToast("Payment posted and matched to invoice.");
      setTimeout(() => setToast(null), 2200);
      setSelected(null);
      loadData(); // re-fetch truth from the backend rather than guessing the new state locally
    } catch (e) {
      setActionError("Network error — could not reach the backend.");
    }
  }

  async function rejectMatch(paymentId) {
    setActionError(null);
    try {
      const res = await fetch(`${API_BASE}/api/matches/${paymentId}/reject`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setActionError(data.message || "Could not send this to review.");
        return;
      }
      setToast("Sent to manual review.");
      setTimeout(() => setToast(null), 2200);
      setSelected(null);
      loadData();
    } catch (e) {
      setActionError("Network error — could not reach the backend.");
    }
  }

  async function resetDemo() {
    await fetch(`${API_BASE}/api/reset`, { method: "POST" });
    loadData();
  }

  if (loading) {
    return <CenteredMessage title="Loading…" subtitle="Fetching payments and invoices from the backend." />;
  }

  if (error) {
    return (
      <CenteredMessage
        title="Something went wrong"
        subtitle={error}
        action={<button onClick={loadData} style={btnPrimary}>Retry</button>}
      />
    );
  }

  const counts = {
    all: rows.length,
    exact: rows.filter((r) => r.status === "exact").length,
    fuzzy: rows.filter((r) => r.status === "fuzzy").length,
    duplicate: rows.filter((r) => r.status === "duplicate").length,
    unmatched: rows.filter((r) => r.status === "unmatched").length,
    posted: rows.filter((r) => r.status === "posted").length,
  };

  const visibleRows = filter === "all" ? rows : rows.filter((r) => r.status === filter);
  const selectedRow = selected ? rows.find((r) => r.payment.id === selected) : null;

  return (
    <div style={{ fontFamily: "'Inter', -apple-system, sans-serif", background: "#F6F7F9", minHeight: "100%", color: "#1A1D23" }}>
      <div style={{ background: "#FFFFFF", borderBottom: "1px solid #E4E6EA", padding: "16px 20px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: "#6B7280", letterSpacing: 0.5, textTransform: "uppercase" }}>
              O2C · Cash Application (split frontend/backend)
            </div>
            <div style={{ fontSize: 20, fontWeight: 700 }}>Cash Application Cockpit</div>
          </div>
          <button onClick={resetDemo} style={{ ...btnSecondary, display: "flex", alignItems: "center", gap: 6 }}>
            <RotateCcw size={14} /> Reset demo
          </button>
        </div>
      </div>

      {kpis && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12, padding: 20 }}>
          <KpiCard label="Cash-application rate" value={`${kpis.cashApplicationRate}%`} sub="Live from backend" accent="#0F7B4A" />
          <KpiCard
            label="DSO (days)"
            value={kpis.dsoAfter}
            sub={`was ${kpis.dsoBefore} before automation`}
            accent="#2563EB"
            trend={kpis.dsoAfter < kpis.dsoBefore ? "down" : null}
          />
          <KpiCard label="Unapplied cash backlog" value={`$${kpis.unappliedBacklog.toLocaleString()}`} sub="Pending review" accent="#B45309" />
        </div>
      )}

      <div style={{ display: "flex", gap: 8, padding: "0 20px 12px", flexWrap: "wrap" }}>
        {[
          ["all", "All", counts.all],
          ["exact", "Exact match", counts.exact],
          ["fuzzy", "Needs review", counts.fuzzy],
          ["duplicate", "Duplicate", counts.duplicate],
          ["unmatched", "Unapplied", counts.unmatched],
          ["posted", "Posted", counts.posted],
        ].map(([key, label, n]) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            style={{
              border: "1px solid " + (filter === key ? "#1A1D23" : "#E4E6EA"),
              background: filter === key ? "#1A1D23" : "#FFFFFF",
              color: filter === key ? "#FFFFFF" : "#374151",
              borderRadius: 999,
              padding: "6px 12px",
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            {label} <span style={{ opacity: 0.7 }}>· {n}</span>
          </button>
        ))}
      </div>

      <div style={{ padding: "0 20px 24px" }}>
        {visibleRows.length === 0 ? (
          <EmptyState filter={filter} />
        ) : (
          <div style={{ background: "#FFFFFF", border: "1px solid #E4E6EA", borderRadius: 10, overflow: "hidden" }}>
            {visibleRows.map((r, i) => (
              <QueueRow key={r.payment.id} row={r} isLast={i === visibleRows.length - 1} onOpen={() => setSelected(r.payment.id)} />
            ))}
          </div>
        )}
      </div>

      {selectedRow && (
        <DetailDrawer
          row={selectedRow}
          error={actionError}
          onClose={() => {
            setSelected(null);
            setActionError(null);
          }}
          onPost={() => postMatch(selectedRow.payment.id)}
          onReject={() => rejectMatch(selectedRow.payment.id)}
        />
      )}

      {toast && (
        <div style={toastStyle}>{toast}</div>
      )}
    </div>
  );
}

function CenteredMessage({ title, subtitle, action }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", minHeight: 300, textAlign: "center", padding: 24, fontFamily: "'Inter', sans-serif" }}>
      <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 6 }}>{title}</div>
      <div style={{ fontSize: 13, color: "#6B7280", maxWidth: 360, marginBottom: 14 }}>{subtitle}</div>
      {action}
    </div>
  );
}

function KpiCard({ label, value, sub, accent, trend }) {
  return (
    <div style={{ background: "#FFFFFF", border: "1px solid #E4E6EA", borderRadius: 10, padding: 16 }}>
      <div style={{ fontSize: 12, color: "#6B7280", fontWeight: 600, marginBottom: 6 }}>{label}</div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
        <div style={{ fontSize: 26, fontWeight: 800, color: accent }}>{value}</div>
        {trend === "down" && <TrendingDown size={16} color="#0F7B4A" />}
      </div>
      <div style={{ fontSize: 12, color: "#6B7280", marginTop: 4 }}>{sub}</div>
    </div>
  );
}

function QueueRow({ row, isLast, onOpen }) {
  const meta = STATUS_META[row.status];
  const Icon = meta.icon;
  return (
    <button
      onClick={onOpen}
      style={{
        width: "100%",
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "14px 16px",
        borderBottom: isLast ? "none" : "1px solid #EEF0F2",
        background: "transparent",
        border: "none",
        cursor: "pointer",
        textAlign: "left",
      }}
    >
      <div style={{ width: 8, height: 8, borderRadius: "50%", background: meta.color, flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <span style={{ fontWeight: 700, fontSize: 14 }}>{row.payment.id}</span>
          <span style={{ fontSize: 13, color: "#6B7280" }}>{row.payment.customer}</span>
        </div>
        <div style={{ fontSize: 12, color: "#9AA1AC", marginTop: 2 }}>
          {row.candidate ? `Proposed match: ${row.candidate.invoice.id}` : "No candidate invoice found"}
        </div>
      </div>
      <div style={{ fontWeight: 700, fontSize: 14, width: 90, textAlign: "right" }}>${row.payment.amount.toLocaleString()}</div>
      <div style={{ background: meta.bg, color: meta.color, fontSize: 12, fontWeight: 700, padding: "4px 10px", borderRadius: 999, display: "flex", alignItems: "center", gap: 4, whiteSpace: "nowrap" }}>
        <Icon size={13} /> {meta.label}
      </div>
      <ChevronRight size={16} color="#9AA1AC" />
    </button>
  );
}

function DetailDrawer({ row, onClose, onPost, onReject, error }) {
  const meta = STATUS_META[row.status];
  const c = row.candidate;
  const amountMismatch = c && c.amtDelta > 0.001;

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(15,17,21,0.4)", display: "flex", justifyContent: "flex-end", zIndex: 50 }}>
      <div style={{ width: "min(420px, 100%)", background: "#FFFFFF", height: "100%", overflowY: "auto", padding: 20, boxShadow: "-8px 0 24px rgba(0,0,0,0.12)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 12, color: "#6B7280", fontWeight: 600 }}>PAYMENT</div>
            <div style={{ fontSize: 20, fontWeight: 800 }}>{row.payment.id}</div>
          </div>
          <button onClick={onClose} style={{ background: "#F1F2F4", border: "none", borderRadius: 8, padding: 6, cursor: "pointer" }}>
            <X size={16} />
          </button>
        </div>

        <span style={{ background: meta.bg, color: meta.color, fontSize: 12, fontWeight: 700, padding: "4px 10px", borderRadius: 999 }}>{meta.label}</span>

        <div style={{ marginTop: 16 }}>
          <Field label="Customer (on payment)" value={row.payment.customer} />
          <Field label="Amount received" value={`$${row.payment.amount.toLocaleString()}`} />
          <Field label="Date received" value={row.payment.date} />
        </div>

        <div style={{ height: 1, background: "#EEF0F2", margin: "16px 0" }} />

        {c ? (
          <>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#6B7280", marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
              <Sparkles size={14} /> BACKEND-PROPOSED MATCH · {Math.round(c.confidence * 100)}% confidence
            </div>
            <Field label="Invoice" value={c.invoice.id} />
            <Field label="Invoice customer" value={c.invoice.customer} />
            <Field label="Invoice amount" value={`$${c.invoice.amount.toLocaleString()}`} />
            <Field label="Invoice due" value={c.invoice.due} />

            <div style={{ marginTop: 12, padding: 12, borderRadius: 8, background: "#F6F7F9", fontSize: 13, color: "#374151", lineHeight: 1.5 }}>
              {row.status === "exact" && "Customer name and amount match the open invoice exactly — safe to auto-post."}
              {row.status === "fuzzy" &&
                (amountMismatch
                  ? `Amount differs from the invoice by $${Math.abs(row.payment.amount - c.invoice.amount).toLocaleString()} (${(c.amtDelta * 100).toFixed(1)}%). Likely a short-pay or deduction — confirm before posting.`
                  : `Customer name on the payment ("${row.payment.customer}") doesn't exactly match the invoice customer ("${c.invoice.customer}"). Likely the same business — confirm before posting.`)}
              {row.status === "duplicate" && "Another payment also proposes this same invoice. The backend will refuse to post either until this is resolved manually."}
            </div>
          </>
        ) : (
          <div style={{ padding: 12, borderRadius: 8, background: "#F6F7F9", fontSize: 13, color: "#374151" }}>
            No open invoice for this customer/amount combination was found. This stays in the unapplied-cash backlog.
          </div>
        )}

        {error && (
          <div style={{ marginTop: 12, display: "flex", gap: 8, alignItems: "flex-start", background: "#FEE4E2", padding: 10, borderRadius: 8 }}>
            <AlertTriangle size={16} color="#B42318" style={{ flexShrink: 0, marginTop: 1 }} />
            <div style={{ fontSize: 12.5, color: "#7A271A" }}>{error}</div>
          </div>
        )}

        <div style={{ display: "flex", gap: 8, marginTop: 20 }}>
          {c && row.status !== "duplicate" && row.status !== "posted" && (
            <button onClick={onPost} style={{ ...btnPrimary, flex: 1 }}>Confirm & post match</button>
          )}
          {row.status !== "posted" && (
            <button onClick={onReject} style={{ ...btnSecondary, flex: 1 }}>Send to manual review</button>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ label, value }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontSize: 11, color: "#9AA1AC", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.3 }}>{label}</div>
      <div style={{ fontSize: 14, fontWeight: 600 }}>{value}</div>
    </div>
  );
}

function EmptyState({ filter }) {
  return (
    <div style={{ background: "#FFFFFF", border: "1px dashed #D1D5DB", borderRadius: 10, padding: 40, textAlign: "center" }}>
      <Inbox size={28} color="#9AA1AC" style={{ margin: "0 auto 10px" }} />
      <div style={{ fontWeight: 700, fontSize: 14 }}>Nothing here right now</div>
      <div style={{ fontSize: 13, color: "#6B7280", marginTop: 4 }}>No payments currently in the "{filter}" state.</div>
    </div>
  );
}

const btnPrimary = {
  background: "#0F7B4A",
  color: "#FFFFFF",
  border: "none",
  borderRadius: 8,
  padding: "10px 14px",
  fontWeight: 700,
  fontSize: 14,
  cursor: "pointer",
};

const btnSecondary = {
  background: "#FFFFFF",
  color: "#374151",
  border: "1px solid #D1D5DB",
  borderRadius: 8,
  padding: "8px 12px",
  fontWeight: 700,
  fontSize: 13,
  cursor: "pointer",
};

const toastStyle = {
  position: "fixed",
  bottom: 20,
  left: "50%",
  transform: "translateX(-50%)",
  background: "#1A1D23",
  color: "#FFFFFF",
  padding: "10px 16px",
  borderRadius: 8,
  fontSize: 13,
  fontWeight: 500,
  boxShadow: "0 4px 12px rgba(0,0,0,0.2)",
};
