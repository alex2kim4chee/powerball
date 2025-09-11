"use client";

import { useMemo, useState } from "react";
import { createPool, importPoolFromFile } from "../../../lib/pool";
import { useRouter } from "next/navigation";

function nextDrawDefault(): Date {
  // Powerball: Mon/Wed/Sat at 22:59 ET
  const tz = "America/New_York";
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const parseParts = (d: Date) => Object.fromEntries(dtf.formatToParts(d).map((p) => [p.type, p.value] as const));
  const makeEtDate = (y: number, m: number, d: number, hh: number, mm: number, ss = 0) => {
    const utcGuess = Date.UTC(y, m - 1, d, hh, mm, ss);
    const parts = parseParts(new Date(utcGuess));
    const gotMs = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second);
    const desiredMs = Date.UTC(y, m - 1, d, hh, mm, ss);
    return new Date(utcGuess - (gotMs - desiredMs));
  };
  const now = new Date();
  const p = parseParts(now);
  const y = +p.year, m = +p.month, d = +p.day, H = +p.hour, M = +p.minute;
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0..6
  const isDrawDay = dow === 1 || dow === 3 || dow === 6;
  const beforeCutoff = H < 22 || (H === 22 && M < 59);
  const addDays = (yy: number, mm: number, dd: number, add: number) => {
    const t = new Date(Date.UTC(yy, mm - 1, dd));
    t.setUTCDate(t.getUTCDate() + add);
    return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate() };
  };
  let ty = y, tm = m, td = d;
  if (!(isDrawDay && beforeCutoff)) {
    let add = isDrawDay ? 1 : 0;
    while (true) {
      add += 1;
      const nd = addDays(y, m, d, add - 1);
      const ndow = new Date(Date.UTC(nd.y, nd.m - 1, nd.d)).getUTCDay();
      if (ndow === 1 || ndow === 3 || ndow === 6) { ty = nd.y; tm = nd.m; td = nd.d; break; }
    }
  }
  return makeEtDate(ty, tm, td, 22, 59, 0);
}

export default function NewPoolPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [initialTickets, setInitialTickets] = useState(1);
  const [pricePer, setPricePer] = useState(2);
  const [date, setDate] = useState<string>(() => {
    const t = nextDrawDefault();
    // to local datetime-local value
    const pad = (n: number) => n.toString().padStart(2, "0");
    const yyyy = t.getFullYear();
    const mm = pad(t.getMonth() + 1);
    const dd = pad(t.getDate());
    const hh = pad(t.getHours());
    const mi = pad(t.getMinutes());
    return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
  });

  const validTickets = useMemo(() => Math.max(1, Math.min(10, Number(initialTickets) || 1)), [initialTickets]);
  const disabled = !date;

  const onCreate = () => {
    const draw = date ? new Date(date) : nextDrawDefault();
    const pool = createPool({ name, drawDate: draw, pricePer: Number(pricePer) || 2, initialTickets: validTickets });
    router.replace(`/pool/${pool.id}`);
  };

  return (
    <main className="section">
      <div className="container" style={{ display: "grid", gap: 16 }}>
        <h1 style={{ margin: 0 }}>Создать пул</h1>
        <div className="card" style={{ padding: 20, display: "grid", gap: 12 }}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <label className="btn btn--ghost" style={{ cursor: "pointer" }}>
              Импорт пула (.json)
              <input
                type="file"
                accept="application/json"
                style={{ display: "none" }}
                onChange={async (e) => {
                  const input = e.currentTarget; // capture before await/navigation
                  const f = input.files?.[0];
                  if (!f) return;
                  try {
                    const imported = await importPoolFromFile(f);
                    if (!imported) {
                      alert("Не удалось импортировать пул: неверный файл или формат.");
                    } else {
                      // Clear the input safely before navigation
                      try { input.value = ""; } catch {}
                      router.replace(`/pool/${imported.id}`);
                      return;
                    }
                  } catch {
                    alert("Не удалось импортировать пул.");
                  } finally {
                    // If still on this page and input exists, clear it
                    try { input.value = ""; } catch {}
                  }
                }}
              />
            </label>
          </div>
          <div aria-hidden style={{ display: "flex", alignItems: "center", gap: 12, color: "var(--text-dim)", marginTop: 4 }}>
            <div style={{ height: 1, background: "var(--glass-border)", flex: 1 }} />
            <span className="small" style={{ whiteSpace: "nowrap" }}>или создать новый пул</span>
            <div style={{ height: 1, background: "var(--glass-border)", flex: 1 }} />
          </div>
          <label style={{ display: "grid", gap: 6 }}>
            <span className="small">Название пула (по желанию)</span>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Напр. Друзья на розыгрыш пятницы" style={{ padding: 12, borderRadius: 12, border: "1px solid var(--glass-border)", background: "var(--glass)", color: "var(--text)" }} />
          </label>
          <label style={{ display: "grid", gap: 6 }}>
            <span className="small">Дата и время тиража</span>
            <input type="datetime-local" value={date} onChange={(e) => setDate(e.target.value)} style={{ padding: 12, borderRadius: 12, border: "1px solid var(--glass-border)", background: "var(--glass)", color: "var(--text)" }} />
          </label>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <label style={{ display: "grid", gap: 6 }}>
              <span className="small">Стартовое кол-во билетов</span>
              <input type="number" min={1} max={10} value={validTickets} onChange={(e) => setInitialTickets(parseInt(e.target.value))} style={{ width: 120, padding: 12, borderRadius: 12, border: "1px solid var(--glass-border)", background: "var(--glass)", color: "var(--text)" }} />
            </label>
            <label style={{ display: "grid", gap: 6 }}>
              <span className="small">Цена билета (демо)</span>
              <input type="number" min={0} value={pricePer} onChange={(e) => setPricePer(parseInt(e.target.value))} style={{ width: 120, padding: 12, borderRadius: 12, border: "1px solid var(--glass-border)", background: "var(--glass)", color: "var(--text)" }} />
            </label>
          </div>
          <div>
            <button className="btn btn--primary" onClick={onCreate} disabled={disabled} aria-disabled={disabled}>Создать пул</button>
          </div>
        </div>
      </div>
    </main>
  );
}
