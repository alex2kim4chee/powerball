"use client";

export const runtime = 'edge';

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import NumberPicker from "../../../components/NumberPicker";
import type { Pool, Selection, Participant, ShareMode } from "../../../lib/pool";
import { getPool, savePool, updatePoolTickets, makeEmptySelection, makeRandomSelection, exportPool, addParticipant, removeParticipant, setContributionTotal, getContributionTotal, setShareMode, setManualPercent, computeShares } from "../../../lib/pool";
import { buildSmartLink } from "../../../lib/share";

function useCountdown(target: Date) {
  const [now, setNow] = useState<Date>(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  const diff = Math.max(0, target.getTime() - now.getTime());
  const s = Math.floor(diff / 1000);
  const days = Math.floor(s / 86400);
  const hours = Math.floor((s % 86400) / 3600);
  const minutes = Math.floor((s % 3600) / 60);
  const seconds = s % 60;
  return { days, hours, minutes, seconds };
}

function Countdown({ target }: { target: Date }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const { days, hours, minutes, seconds } = useCountdown(target);
  const pad = (n: number) => n.toString().padStart(2, "0");
  if (!mounted) return <span className="countdown" aria-hidden>--д&nbsp;--ч&nbsp;--м&nbsp;--с</span>;
  return (
    <span className="countdown" role="timer" aria-live="polite" aria-label="Таймер до следующего тиража">
      {days > 0 && (<><strong>{pad(days)}</strong>д&nbsp;</>)}
      <strong>{pad(hours)}</strong>ч&nbsp;
      <strong>{pad(minutes)}</strong>м&nbsp;
      <strong>{pad(seconds)}</strong>с
    </span>
  );
}

// Next 15 may type `params` as an async value; keep it flexible to satisfy TS across versions
export default function PoolPage({ params }: any) {
  const router = useRouter();
  const poolId = (params as any)?.id as string;
  const [pool, setPool] = useState<Pool | null>(null);
  const [tickets, setTickets] = useState<Selection[]>([]);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [shareMode, setMode] = useState<ShareMode>("equal");
  const ticketRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [pendingScrollIndex, setPendingScrollIndex] = useState<number | null>(null);
  const participantsRef = useRef<HTMLDivElement | null>(null);
  const [showExportGuard, setShowExportGuard] = useState(false);
  const [guardBank, setGuardBank] = useState(0);
  const [guardContrib, setGuardContrib] = useState(0);
  const [guardDelta, setGuardDelta] = useState(0);
  const [guardMismatch, setGuardMismatch] = useState(false);
  const [guardTicketsInvalid, setGuardTicketsInvalid] = useState(false);
  const [guardEmailsInvalid, setGuardEmailsInvalid] = useState(false);
  const [highlightContrib, setHighlightContrib] = useState(false);
  const [highlightEmail, setHighlightEmail] = useState(false);
  const exportGuardRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const p = getPool(poolId);
    setPool(p);
    setTickets(p?.tickets ?? [makeEmptySelection()]);
    setParticipants(p?.participants ?? []);
    setMode(p?.shareMode ?? "equal");
  }, [poolId]);

  useEffect(() => {
    if (!pool) return;
    updatePoolTickets(pool.id, tickets);
    setPool({ ...pool, tickets });
  }, [tickets]);

  useEffect(() => {
    if (pendingScrollIndex == null) return;
    const el = ticketRefs.current[pendingScrollIndex];
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start", inline: "nearest" });
    const id = window.setTimeout(() => setPendingScrollIndex(null), 300);
    return () => window.clearTimeout(id);
  }, [pendingScrollIndex, tickets.length]);

  useEffect(() => {
    if (showExportGuard) {
      // Smooth scroll to the guard banner and focus it for accessibility
      exportGuardRef.current?.scrollIntoView({ behavior: "smooth", block: "start", inline: "nearest" });
      window.setTimeout(() => exportGuardRef.current?.focus?.(), 300);
    }
  }, [showExportGuard]);

  if (!pool) {
    return (
      <main className="section">
        <div className="container">
          <div className="card" style={{ padding: 20 }}>
            <h2 style={{ margin: 0 }}>Пул не найден</h2>
            <div className="small">Проверьте ссылку или создайте новый пул.</div>
          </div>
        </div>
      </main>
    );
  }

  const target = new Date(pool.drawDateISO);
  const pricePer = pool.pricePer;
  const allValid = tickets.every((s) => s.numbers.length === 5 && s.power != null);
  const total = tickets.length * pricePer;
  const participantCount = participants.length;
  const { shares, percentSum } = computeShares(pool);
  const hasHolder = participants.some((p) => p.role === "holder");

  const bank = (tickets.length || 0) * (pricePer || 0);
  const contribSum = participants.reduce((s, p) => s + (getContributionTotal(pool, p.id) || 0), 0);
  const delta = contribSum - bank;

  const fmtMoney = (n: number) => `$${n.toFixed(2)}`;

  const addTicket = () => {
    if (tickets.length >= 10) return;
    setPendingScrollIndex(tickets.length);
    setTickets((prev) => [...prev, makeEmptySelection()]);
  };
  const removeTicket = () => {
    if (tickets.length <= 1) return;
    setPendingScrollIndex(Math.max(0, tickets.length - 2));
    setTickets((prev) => prev.slice(0, -1));
  };

  const exportJson = () => {
    if (!pool) return;
    const mismatch = Math.abs(delta) > 0.01; // more than 1 cent difference
    const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const emailInvalid = participants.some((p) => !p.email || !emailRe.test(p.email));

    if (!allValid || mismatch || emailInvalid) {
      // snapshot current issues
      setGuardTicketsInvalid(!allValid);
      setGuardMismatch(mismatch);
      setGuardEmailsInvalid(emailInvalid);
      if (mismatch) {
        setGuardBank(bank);
        setGuardContrib(contribSum);
        setGuardDelta(delta);
      } else {
        setGuardBank(0); setGuardContrib(0); setGuardDelta(0);
      }
      setShowExportGuard(true);
      return;
    }
    const blob = exportPool({ ...pool, tickets });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `pool-${pool.name || pool.id}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // import is now only available on the create page

  return (
    <main className="section">
      <div className="container" style={{ display: "grid", gap: 16 }}>
        <div className="card" style={{ padding: 20 }}>
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", minWidth: 0 }}>
            <div>
              <h1 style={{ margin: 0 }}>{pool.name || "Пул"}</h1>
              <div className="small">Тираж: <span suppressHydrationWarning>{target.toLocaleString()}</span> • Цена билета ${pricePer}</div>
            </div>
            <div className="countdown"><Countdown target={target} /></div>
          </div>
        </div>

        <div className="card" style={{ padding: 20, display: "grid", gap: 12 }}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", minWidth: 0 }}>
            <div className="small">Количество билетов: {tickets.length}</div>
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <button className="btn btn--ghost" onClick={() => setTickets((prev) => prev.map(() => makeRandomSelection()))}>Заполнить все случайно</button>
              <button className="btn btn--ghost" onClick={() => setTickets((prev) => prev.map(() => makeEmptySelection()))}>Очистить все</button>
            </div>
          </div>
          {tickets.map((sel, i) => (
            <div key={i} ref={(el) => { ticketRefs.current[i] = el; }}>
              <NumberPicker value={sel} onChange={(s) => setTickets((prev) => prev.map((p, idx) => (idx === i ? s : p)))} title={`Билет #${i + 1}`} />
            </div>
          ))}
          <div style={{ display: "flex", gap: 12, alignItems: "center", justifyContent: "space-between", marginTop: 4, flexWrap: "wrap", minWidth: 0 }}>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              <button className="btn btn--ghost" onClick={addTicket} disabled={tickets.length >= 10} aria-disabled={tickets.length >= 10}>Добавить билет</button>
              <button className="btn btn--ghost" onClick={removeTicket} disabled={tickets.length <= 1} aria-disabled={tickets.length <= 1}>Удалить</button>
              <span className="small">Всего: {tickets.length}</span>
            </div>
            <div className="sticky-panel">
              <button className="btn btn--primary" disabled={!allValid} aria-disabled={!allValid}>К оплате — ${total}</button>
            </div>
          </div>
        </div>

        {/* Participants and Shares */}
        <div ref={participantsRef} className="card" style={{ padding: 20, display: "grid", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
            <h3 style={{ margin: 0 }}>Участники и доли</h3>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              <select value={shareMode} onChange={(e) => { const m = e.target.value as ShareMode; setMode(m); setPool(setShareMode(pool, m)); }} style={{ padding: 10, borderRadius: 10, background: "var(--glass)", color: "var(--text)", border: "1px solid var(--glass-border)" }}>
                <option value="equal">Поровну</option>
                <option value="byContrib">По вкладам</option>
                <option value="manual">Вручную</option>
              </select>
              <button className="btn btn--ghost" onClick={() => { const upd = addParticipant(pool, `Участник ${participants.length + 1}`); setPool(upd); setParticipants(upd.participants); }}>Добавить участника</button>
            </div>
          </div>

          {participantCount === 0 && (
            <div className="small">Добавьте хотя бы одного участника, чтобы рассчитать доли.</div>
          )}

          {participants.map((p) => {
            const contrib = getContributionTotal(pool, p.id);
            const share = shares.find((s) => s.participantId === p.id);
            const percent = share?.percent ?? 0;
            const amount = share?.amount ?? 0;
            const emailVal = p.email ?? "";
            const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailVal);
            return (
              <div key={p.id} className="card" style={{ padding: 12, display: "grid", gap: 10 }}>
                <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", justifyContent: "space-between" }}>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                    <input value={p.name} onChange={(e) => {
                      const next = { ...p, name: e.target.value } as Participant;
                      const list = participants.map((x) => (x.id === p.id ? next : x));
                      const updated = { ...pool, participants: list } as Pool;
                      savePool(updated); setPool(updated); setParticipants(list);
                    }} style={{ padding: 10, borderRadius: 10, background: "var(--glass)", color: "var(--text)", border: "1px solid var(--glass-border)", minWidth: 0, flex: "1 1 220px" }} />
                    <select value={p.role} onChange={(e) => {
                      // allow only one holder; if new holder selected, demote others
                      const val = e.target.value as Participant["role"];
                      let list = participants.map((x) => (x.id === p.id ? { ...x, role: val } : x));
                      if (val === "holder") list = list.map((x) => (x.id !== p.id && x.role === "holder" ? { ...x, role: "member" } : x));
                      const updated = { ...pool, participants: list } as Pool;
                      savePool(updated); setPool(updated); setParticipants(list);
                    }} style={{ padding: 10, borderRadius: 10, background: "var(--glass)", color: "var(--text)", border: "1px solid var(--glass-border)", minWidth: 0, flex: "0 1 200px" }}>
                      <option value="member">Участник</option>
                      <option value="holder">Держатель билета</option>
                    </select>
                  </div>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                    <button className="btn btn--ghost" onClick={() => { const upd = removeParticipant(pool, p.id); setPool(upd); setParticipants(upd.participants); }}>Удалить</button>
                  </div>
                </div>
                <div style={{ display: "grid", gap: 8 }}>
                  <label style={{ display: "grid", gap: 6 }}>
                    <span className="small">Email (обязательно)</span>
                    <input
                      type="email"
                      placeholder="name@example.com"
                      value={emailVal}
                      aria-invalid={!emailValid}
                      aria-required
                      onChange={(e) => {
                        const next = { ...p, email: e.target.value } as Participant;
                        const list = participants.map((x) => (x.id === p.id ? next : x));
                        const updated = { ...pool, participants: list } as Pool;
                        savePool(updated); setPool(updated); setParticipants(list);
                      }}
                      style={{ padding: 10, borderRadius: 10, background: "var(--glass)", color: "var(--text)", border: `1px solid ${emailValid ? 'var(--glass-border)' : '#ff4d4f'}`, boxShadow: (!emailValid || highlightEmail && !emailVal) ? '0 0 0 2px rgba(255,77,79,0.25)' : undefined, width: "100%" }}
                    />
                    {!emailValid && (
                      <span className="small" style={{ color: '#ff9a9b' }}>{emailVal ? 'Введите корректный email (например, name@example.com).' : 'Email обязателен для каждого участника.'}</span>
                    )}
                  </label>
                </div>
                <div style={{ display: "grid", gap: 8, gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))" }}>
                  <label style={{ display: "grid", gap: 6 }}>
                    <span className="small">Вклад (сумма)</span>
                    <input aria-invalid={highlightContrib} type="number" min={0} value={contrib} onChange={(e) => {
                      const amt = parseFloat(e.target.value || "0");
                      const upd = setContributionTotal(pool, p.id, isNaN(amt) ? 0 : amt);
                      setPool(upd);
                    }} style={{ padding: 10, borderRadius: 10, background: "var(--glass)", color: "var(--text)", border: `1px solid ${highlightContrib ? '#ff4d4f' : 'var(--glass-border)'}`, boxShadow: highlightContrib ? '0 0 0 2px rgba(255,77,79,0.25)' : undefined, width: "100%" }} />
                  </label>
                  <label style={{ display: "grid", gap: 6 }}>
                    <span className="small">Доля, %</span>
                    <input type="number" min={0} max={100} step={0.01} value={shareMode === "manual" ? (pool.manualOverrides?.[p.id] ?? 0) : percent} disabled={shareMode !== "manual"} onChange={(e) => {
                      const val = parseFloat(e.target.value || "0");
                      const upd = setManualPercent(pool, p.id, isNaN(val) ? 0 : val);
                      setPool(upd);
                    }} style={{ padding: 10, borderRadius: 10, background: "var(--glass)", color: "var(--text)", border: "1px solid var(--glass-border)", width: "100%" }} />
                  </label>
                  <label style={{ display: "grid", gap: 6 }}>
                    <span className="small">Доля от банка</span>
                    <input readOnly value={`$${(amount || 0).toLocaleString("en-US")}`} style={{ padding: 10, borderRadius: 10, background: "var(--glass)", color: "var(--text)", border: "1px solid var(--glass-border)", width: "100%" }} />
                  </label>
                </div>
              </div>
            );
          })}

          <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
            {!hasHolder && participantCount > 0 && <span className="small" style={{ color: "#F6C343" }}>Укажите держателя билета.</span>}
            {shareMode === "manual" && (percentSum !== 100) && <span className="small" style={{ color: "#F6C343" }}>Сумма долей: {percentSum}% — должна быть 100%.</span>}
            {shareMode === "byContrib" && participants.every((p)=> getContributionTotal(pool, p.id) <= 0) && <span className="small" style={{ color: "#F6C343" }}>Вклады не указаны — введите суммы или переключитесь на режим "Поровну".</span>}
          </div>
        </div>

        <div className="card" style={{ padding: 20, display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "space-between" }}>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <button className="btn btn--ghost" onClick={exportJson}>Экспорт пула (.json)</button>
            <button className="btn btn--ghost" onClick={async () => {
              if (!pool) return;
              const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
              const emailInvalid = participants.some((p) => !p.email || !emailRe.test(p.email));
              const mismatch = Math.abs(delta) > 0.01;
              if (!allValid || mismatch || emailInvalid) {
                setGuardTicketsInvalid(!allValid);
                setGuardMismatch(mismatch);
                setGuardEmailsInvalid(emailInvalid);
                if (mismatch) { setGuardBank(bank); setGuardContrib(contribSum); setGuardDelta(delta); }
                setShowExportGuard(true);
                return;
              }
              const origin = (typeof window !== 'undefined' && window.location?.origin) ? window.location.origin : '';
              const link = await buildSmartLink(pool, origin);
              try {
                await navigator.clipboard.writeText(link);
                alert("Ссылка скопирована в буфер обмена.");
              } catch {
                prompt("Скопируйте ссылку:", link);
              }
            }}>Скопировать ссылку с данными</button>
          </div>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <button className="btn btn--primary" onClick={() => {
              if (!pool) return;
              // Reuse same validations as export
              const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
              const emailInvalid = participants.some((p) => !p.email || !emailRe.test(p.email));
              const mismatch = Math.abs(delta) > 0.01;
              if (!allValid || mismatch || emailInvalid) {
                setGuardTicketsInvalid(!allValid);
                setGuardMismatch(mismatch);
                setGuardEmailsInvalid(emailInvalid);
                if (mismatch) { setGuardBank(bank); setGuardContrib(contribSum); setGuardDelta(delta); }
                setShowExportGuard(true);
                return;
              }
              window.open(`/pool/${pool.id}/agreement`, "_blank", "noopener");
            }}>Сгенерировать договор (PDF)</button>
          </div>
        </div>

        {showExportGuard && (
          <div ref={exportGuardRef} tabIndex={-1} role="alertdialog" aria-labelledby="export-guard-title" className="card" style={{ padding: 20, display: "grid", gap: 10, borderColor: "#ff4d4f" }}>
            <h3 id="export-guard-title" style={{ margin: 0 }}>Требуются исправления</h3>
            {guardTicketsInvalid && (
              <div className="small">Сначала заполните билет(ы): у каждого должно быть 5 чисел и 1 PowerBall.</div>
            )}
            {guardMismatch && (
              <div className="small">
                Стоимость билетов (банк): <strong>{fmtMoney(guardBank)}</strong>. Сумма вкладов: <strong>{fmtMoney(guardContrib)}</strong>. Разница: <strong>{fmtMoney(Math.abs(guardDelta))}</strong>.
                Экспорт будет доступен, когда сумма вкладов ровно совпадёт со стоимостью всех билетов.
              </div>
            )}
            {guardEmailsInvalid && (
              <div className="small">У каждого участника должен быть корректный email.</div>
            )}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button className="btn btn--primary" onClick={() => {
                setShowExportGuard(false);
                if (guardTicketsInvalid) {
                  const idx = tickets.findIndex((s) => s.numbers.length !== 5 || s.power == null);
                  if (idx >= 0) {
                    setPendingScrollIndex(idx);
                  }
                }
                if (guardMismatch) {
                  setHighlightContrib(true);
                  participantsRef.current?.scrollIntoView({ behavior: "smooth", block: "start", inline: "nearest" });
                  window.setTimeout(() => setHighlightContrib(false), 2200);
                }
                if (guardEmailsInvalid) {
                  setHighlightEmail(true);
                  participantsRef.current?.scrollIntoView({ behavior: "smooth", block: "start", inline: "nearest" });
                  window.setTimeout(() => setHighlightEmail(false), 2200);
                }
              }}>Исправить</button>
              <button className="btn btn--ghost" onClick={() => setShowExportGuard(false)}>Отмена</button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
