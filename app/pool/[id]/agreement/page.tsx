"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import type { Pool } from "../../../../lib/pool";
import { getPool, getContributionTotal, computeShares } from "../../../../lib/pool";
import { buildSmartLink, digestPoolForAgreement } from "../../../../lib/share";

function useDigest(input: unknown) {
  const [hex, setHex] = useState<string>("");
  useEffect(() => {
    let cancelled = false;
    async function run() {
      try {
        const text = JSON.stringify(input);
        const enc = new TextEncoder();
        const buf = enc.encode(text);
        const hash = await crypto.subtle.digest("SHA-256", buf);
        const arr = Array.from(new Uint8Array(hash));
        const h = arr.map((b) => b.toString(16).padStart(2, "0")).join("");
        if (!cancelled) setHex(h);
      } catch {
        if (!cancelled) setHex("");
      }
    }
    run();
    return () => { cancelled = true; };
  }, [input]);
  return hex;
}

export default function AgreementPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;
  const [pool, setPool] = useState<Pool | null>(null);

  useEffect(() => {
    const p = getPool(id);
    setPool(p);
  }, [id]);

  const bank = useMemo(() => (pool?.tickets?.length || 0) * (pool?.pricePer || 0), [pool]);
  const shares = useMemo(() => (pool ? computeShares(pool) : { shares: [], percentSum: 0 }), [pool]);
  const participants = pool?.participants ?? [];

  const digestInput = useMemo(() => {
    if (!pool) return {};
    return {
      version: 1,
      id: pool.id,
      name: pool.name,
      drawDateISO: pool.drawDateISO,
      pricePer: pool.pricePer,
      tickets: pool.tickets,
      participants: participants.map((p) => ({ id: p.id, name: p.name, email: p.email, role: p.role })),
      shareMode: pool.shareMode,
      manualOverrides: pool.manualOverrides ?? {},
      createdAt: pool.createdAt,
      updatedAt: pool.updatedAt,
    };
  }, [pool, participants]);

  const digest = useDigest(digestInput);

  const [qrDataUrl, setQrDataUrl] = useState<string>("");
  const [qrLink, setQrLink] = useState<string>("");

  useEffect(() => {
    let cancelled = false;
    async function run() {
      try {
        if (!pool) return;
        // Build a real, scannable URL using current origin
        const origin = (typeof window !== 'undefined' && window.location?.origin) ? window.location.origin : (process.env.NEXT_PUBLIC_SITE_URL || "");
        const link = await buildSmartLink(pool, origin);
        // Dynamic import to avoid hard dependency if not installed yet
        const mod: any = await import("qrcode").catch(() => null);
        const toDataURL = mod?.toDataURL || mod?.default?.toDataURL;
        if (toDataURL) {
          const url = await toDataURL(link, { margin: 1, scale: 4, errorCorrectionLevel: "M" });
          if (!cancelled) { setQrDataUrl(url); setQrLink(link); }
        } else {
          if (!cancelled) { setQrDataUrl(""); setQrLink(link); }
        }
      } catch {
        if (!cancelled) setQrDataUrl("");
      }
    }
    run();
    return () => { cancelled = true; };
  }, [pool, digest]);

  useEffect(() => {
    const t = setTimeout(() => { try { window.print(); } catch {} }, 600);
    return () => clearTimeout(t);
  }, []);

  if (!pool) {
    return (
      <main className="section">
        <div className="container">
          <div className="card" style={{ padding: 20 }}>
            <h2 style={{ margin: 0 }}>Пул не найден</h2>
          </div>
        </div>
      </main>
    );
  }

  const d = new Date(pool.drawDateISO);

  return (
    <main className="section">
      <div className="container" style={{ display: "grid", gap: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
          <h1 style={{ margin: 0 }}>Соглашение о совместном участии в лотерейном пуле</h1>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn btn--ghost" onClick={() => window.print()}>Печать / PDF</button>
            <button className="btn btn--ghost" onClick={() => router.replace(`/pool/${pool.id}`)}>К пулу</button>
          </div>
        </div>

        <div className="card" style={{ padding: 20, display: "grid", gap: 8 }}>
          <div className="small">Пул: <strong>{pool.name || "Без названия"}</strong> • ID: {pool.id}</div>
          <div className="small">Тираж: <strong>{d.toLocaleString()}</strong> • Лотерея: Powerball (США)</div>
          <div className="small">Юрисдикция: Содружество Пенсильвания, США</div>
          <div className="small">Создан: {new Date(pool.createdAt).toLocaleString()} • Обновлён: {new Date(pool.updatedAt).toLocaleString()}</div>
        </div>

        <div className="card" style={{ padding: 20, display: "grid", gap: 12 }}>
          <h3 style={{ margin: 0 }}>Стороны</h3>
          <div className="small">Держатель билета: <strong>{participants.find((p) => p.role === "holder")?.name || "—"}</strong> ({participants.find((p) => p.role === "holder")?.email || "—"})</div>
          <div className="small">Участники: см. Приложение B.</div>
        </div>

        <div className="card" style={{ padding: 20, display: "grid", gap: 12 }}>
          <h3 style={{ margin: 0 }}>Покупка и хранение билетов</h3>
          <div className="small">
            Держатель покупает билеты у официального ритейлера или через официальный канал соответствующего штата, находясь физически в Пенсильвании или в другом штате, где присутствует официальный ритейлер. Оригиналы билетов хранятся у держателя до закрытия пула.
          </div>
        </div>

        <div className="card" style={{ padding: 20, display: "grid", gap: 12 }}>
          <h3 style={{ margin: 0 }}>Вклады, банк и доли</h3>
          <div className="small">Банк (стоимость билетов): <strong>${bank.toFixed(2)}</strong>. Сверка суммы вкладов с Банком обязательна до финализации.</div>
          <div className="small">Доли участников указаны в Приложении B (режим: {pool.shareMode === "equal" ? "поровну" : pool.shareMode === "byContrib" ? "по вкладам" : "вручную"}). Выплаты рассчитываются из чистой суммы выигрыша после удержания применимых налогов.</div>
        </div>

        <div className="card" style={{ padding: 20, display: "grid", gap: 12 }}>
          <h3 style={{ margin: 0 }}>Заявление выигрыша и выплаты</h3>
          <div className="small">Держатель заявляет выигрыш по правилам штата и оператора лотереи. Чистая сумма после удержания налогов распределяется по долям в разумный срок (как правило, до 15 рабочих дней после получения средств).</div>
          <div className="small">Возможные расходы на получение выигрыша и банковские комиссии могут компенсироваться из Банка или из чистой суммы по согласию участников.</div>
        </div>

        <div className="card" style={{ padding: 20, display: "grid", gap: 12 }}>
          <h3 style={{ margin: 0 }}>Иностранные участники</h3>
          <div className="small">Выплаты нерезидентам США осуществляются как выплаты по договорённости; возможны требования отчётности и налоговые последствия в США и стране получателя. Участники предоставляют необходимые данные/формы для законной выплаты.</div>
        </div>

        <div className="card" style={{ padding: 20, display: "grid", gap: 12 }}>
          <h3 style={{ margin: 0 }}>Заявления и гарантии</h3>
          <div className="small">18+. Игра на собственный риск. Шансы на крупный выигрыш низкие; отсутствуют гарантии выигрыша.</div>
          <div className="small">Данный документ и сервис не являются юридической или налоговой консультацией. При существенных суммах рекомендуется консультация CPA/юриста.</div>
        </div>

        <div className="card" style={{ padding: 20, display: "grid", gap: 12 }}>
          <h3 style={{ margin: 0 }}>Прозрачность и верификация</h3>
          <div className="small">Для проверки целостности сформирован контрольный дайджест данных пула (AgreementDigest):</div>
          <div className="small" style={{ wordBreak: "break-all" }}><strong>{digest || "…"}</strong></div>
          <div style={{ display: "grid", gap: 8 }}>
            {qrDataUrl ? (
              <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                <img src={qrDataUrl} alt="QR‑код договора" style={{ width: 128, height: 128, imageRendering: "pixelated", borderRadius: 8, border: "1px solid var(--glass-border)" }} />
                <div className="small">Сканируйте QR, чтобы открыть карточку пула и сверить дайджест.</div>
              </div>
            ) : (
              <div className="small">QR‑код недоступен (библиотека не установлена). Используйте ссылку ниже и текстовый дайджест.</div>
            )}
            {qrLink && (
              <div className="small" style={{ wordBreak: "break-all" }}>
                Ссылка: <a href={qrLink} target="_blank" rel="noopener">{qrLink}</a>
              </div>
            )}
          </div>
        </div>

        <div className="card" style={{ padding: 20, display: "grid", gap: 8 }}>
          <h3 style={{ margin: 0 }}>Приложение A. Билеты</h3>
          <div className="small">Тираж: {d.toLocaleString()} • Цена за билет: ${pool.pricePer.toFixed(2)} • Итого билетов: {pool.tickets.length} • Банк: ${bank.toFixed(2)}</div>
          <div style={{ display: "grid", gap: 6 }}>
            {pool.tickets.map((t, i) => (
              <div key={i} className="small">Билет #{i + 1}: {t.numbers.join(" ")} • PB {t.power}</div>
            ))}
          </div>
        </div>

        <div className="card" style={{ padding: 20, display: "grid", gap: 8 }}>
          <h3 style={{ margin: 0 }}>Приложение B. Участники и доли</h3>
          <div className="small">Всего участников: {participants.length}</div>
          <div style={{ display: "grid", gap: 8 }}>
            {participants.map((p) => {
              const s = shares.shares.find((x) => x.participantId === p.id);
              const contrib = getContributionTotal(pool, p.id);
              return (
                <div key={p.id} className="small" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 8 }}>
                  <div><strong>{p.name}</strong> ({p.email})</div>
                  <div>Роль: {p.role === "holder" ? "держатель" : "участник"}</div>
                  <div>Вклад: ${contrib.toFixed(2)}</div>
                  <div>Доля: {(s?.percent ?? 0).toFixed(2)}%</div>
                  <div>Доля от банка: ${((s?.amount ?? 0)).toFixed(2)}</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <style jsx global>{`
        @media print {
          body { background: #fff !important; color: #000 !important; }
          .card { background: #fff !important; border: 1px solid #ccc !important; box-shadow: none !important; }
          .btn, .hero, .section .container > .card:first-child .btn { display: none !important; }
        }
      `}</style>
    </main>
  );
}
