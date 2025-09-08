"use client";

import { useMemo, useState } from "react";
import { createPool, importPoolFromFile } from "../../../lib/pool";
import { useRouter } from "next/navigation";

function nextDrawDefault(): Date {
  const d = new Date();
  d.setSeconds(0, 0);
  const target = new Date(d);
  target.setHours(23, 0, 0, 0);
  if (d.getTime() > target.getTime()) target.setDate(target.getDate() + 1);
  return target;
}

export default function NewPoolPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [initialTickets, setInitialTickets] = useState(1);
  const [pricePer, setPricePer] = useState(5);
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
    const pool = createPool({ name, drawDate: draw, pricePer: Number(pricePer) || 5, initialTickets: validTickets });
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
