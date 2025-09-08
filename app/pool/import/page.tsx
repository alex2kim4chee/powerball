"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { Pool } from "../../../lib/pool";
import { savePool, getPool } from "../../../lib/pool";
import { unpackSmartLinkData } from "../../../lib/share";

export default function ImportFromLinkPage() {
  const router = useRouter();
  const [status, setStatus] = useState<"idle" | "parsing" | "ready" | "error">("parsing");
  const [error, setError] = useState<string | null>(null);
  const [payload, setPayload] = useState<any>(null);

  useEffect(() => {
    const hash = typeof window !== 'undefined' ? window.location.hash : "";
    const res = unpackSmartLinkData(hash);
    if (!res.ok) {
      setError(res.error || "invalid");
      setStatus("error");
      return;
    }
    setPayload(res.data);
    setStatus("ready");
  }, []);

  const pool: Pool | null = useMemo(() => payload?.pool ?? null, [payload]);

  return (
    <main className="section">
      <div className="container" style={{ display: "grid", gap: 16 }}>
        <h1 style={{ margin: 0 }}>Импорт пула по ссылке</h1>

        {status === "parsing" && (
          <div className="card" style={{ padding: 20 }}>Чтение данных…</div>
        )}

        {status === "error" && (
          <div className="card" style={{ padding: 20, display: "grid", gap: 8 }}>
            <h3 style={{ margin: 0 }}>Не удалось прочитать данные</h3>
            <div className="small">Код: {error}</div>
            <div className="small">Убедитесь, что ссылка не была обрезана мессенджером. При необходимости используйте Экспорт/Импорт файла на странице создания пула.</div>
          </div>
        )}

        {status === "ready" && pool && (
          <div className="card" style={{ padding: 20, display: "grid", gap: 12 }}>
            <h3 style={{ margin: 0 }}>Предпросмотр</h3>
            <div className="small">Имя: <strong>{pool.name || "Без названия"}</strong> • ID: {pool.id}</div>
            <div className="small">Тираж: {new Date(pool.drawDateISO).toLocaleString()}</div>
            <div className="small">Билетов: {pool.tickets.length} • Цена: ${pool.pricePer.toFixed(2)} • Банк: ${(pool.tickets.length * pool.pricePer).toFixed(2)}</div>
            <div className="small">Участников: {pool.participants.length}</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button className="btn btn--primary" onClick={() => {
                // if pool with same id exists, create a copy with new id
                const exists = getPool(pool.id);
                let toSave: Pool = pool;
                if (exists) {
                  const newId = (crypto as any)?.randomUUID ? (crypto as any).randomUUID() : pool.id + "-" + Math.random().toString(36).slice(2,8);
                  toSave = { ...pool, id: newId, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
                }
                savePool(toSave);
                router.replace(`/pool/${toSave.id}`);
              }}>Восстановить пул</button>
              <button className="btn btn--ghost" onClick={() => router.replace("/")}>Отмена</button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

