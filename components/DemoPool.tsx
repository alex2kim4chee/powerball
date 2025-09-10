"use client";

import { useMemo, useRef, useState, useEffect } from "react";
import NumberPicker from "./NumberPicker";
import type { Selection, Participant, Contribution, ShareMode, Pool } from "../lib/pool";
import { computeShares } from "../lib/pool";

function NextDrawDate() {
  const tz = "America/New_York"; // ET schedule
  const dtf = new Intl.DateTimeFormat("en-US", { timeZone: tz, hour12: false, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" });
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
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
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

export default function DemoPool() {
  const target = NextDrawDate();
  const pricePer = 5;
  const [tickets, setTickets] = useState<Selection[]>([{ numbers: [], power: null }]);
  const [participants, setParticipants] = useState<Participant[]>([
    { id: "p1", name: "", role: "holder", email: "" },
    { id: "p2", name: "", role: "member", email: "" },
    { id: "p3", name: "", role: "member", email: "" },
  ]);
  const [contributions, setContributions] = useState<Contribution[]>([
    { id: "c1", participantId: "p1", amount: 0, createdAt: new Date().toISOString() },
    { id: "c2", participantId: "p2", amount: 0, createdAt: new Date().toISOString() },
    { id: "c3", participantId: "p3", amount: 0, createdAt: new Date().toISOString() },
  ]);
  const [shareMode, setShareMode] = useState<ShareMode>("byContrib");
  const [showAgreement, setShowAgreement] = useState(false);
  const agreementRef = useRef<HTMLDivElement | null>(null);

  // Smooth scroll to top of agreement when opened
  useEffect(() => {
    if (showAgreement) {
      // small delay to ensure layout is ready
      setTimeout(() => {
        const el = agreementRef.current;
        if (el) {
          try { el.scrollTo({ top: 0, behavior: 'smooth' }); } catch { el.scrollTop = 0; }
          // Focus the heading for accessibility if present
          const h = el.querySelector('h3');
          if (h instanceof HTMLElement) h.focus?.();
        }
      }, 50);
    }
  }, [showAgreement]);

  const demoFill = () => {
    setTickets([{ numbers: [7, 14, 21, 28, 35], power: 7 }]);
    setParticipants([
      { id: "p1", name: "Алексей Смирнов", role: "holder", email: "alexey.smirnov@example.com" },
      { id: "p2", name: "Пётр Иванов", role: "member", email: "petr.ivanov@example.com" },
      { id: "p3", name: "Сергей Кузнецов", role: "member", email: "sergey.kuznetsov@example.com" },
    ]);
    setContributions([
      { id: "c1", participantId: "p1", amount: 1, createdAt: new Date().toISOString() },
      { id: "c2", participantId: "p2", amount: 2, createdAt: new Date().toISOString() },
      { id: "c3", participantId: "p3", amount: 2, createdAt: new Date().toISOString() },
    ]);
  };
  const reset = () => {
    setTickets([{ numbers: [], power: null }]);
    setParticipants([
      { id: "p1", name: "", role: "holder", email: "" },
      { id: "p2", name: "", role: "member", email: "" },
      { id: "p3", name: "", role: "member", email: "" },
    ]);
    setContributions([
      { id: "c1", participantId: "p1", amount: 0, createdAt: new Date().toISOString() },
      { id: "c2", participantId: "p2", amount: 0, createdAt: new Date().toISOString() },
      { id: "c3", participantId: "p3", amount: 0, createdAt: new Date().toISOString() },
    ]);
  };

  const poolLike = useMemo(() => ({
    id: "demo", name: "Демо пул", drawDateISO: target.toISOString(), pricePer,
    tickets, participants, contributions, shareMode, manualOverrides: {}, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
  }) as unknown as Pool, [tickets, participants, contributions, shareMode]);

  const bank = tickets.length * pricePer;
  const { shares, percentSum } = computeShares(poolLike);
  const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const emailsValid = participants.every(p => !!p.email && emailRe.test(p.email));
  const ticketsValid = tickets.every(t => t.numbers.length === 5 && t.power != null);
  const contribSum = contributions.reduce((s,c)=>s+(c.amount||0),0);
  const bankMatches = Math.abs(bank - contribSum) <= 0.01;

  return (
    <div className="card" style={{ padding: 20, display: "grid", gap: 16 }}>
      {/* Header like real pool */}
      <div className="card" style={{ padding: 20 }}>
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", minWidth: 0 }}>
          <div>
            <h2 style={{ margin: 0 }}>Демо пул</h2>
            <div className="small">Тираж: сегодня, <span suppressHydrationWarning>{target.toLocaleDateString()}</span> • Цена билета ${pricePer}</div>
          </div>
        </div>
      </div>

      {/* Tickets block like real pool, but read-only */}
      <div className="card" style={{ padding: 20, display: "grid", gap: 12 }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", minWidth: 0 }}>
          <div className="small">Количество билетов: 1</div>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <button className="btn btn--ghost" onClick={demoFill}>Заполнить демо</button>
            <button className="btn btn--ghost" onClick={reset}>Сбросить</button>
          </div>
        </div>
        <div style={{ pointerEvents: 'none', opacity: 0.9 }}>
          <NumberPicker value={tickets[0]} onChange={() => { /* read-only demo */ }} title="Билет #1" />
        </div>
      </div>

      {/* Participants and shares like real pool, read-only and empty until demo */}
      <div className="card" style={{ padding: 20, display: "grid", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <h3 style={{ margin: 0 }}>Участники и доли</h3>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <select disabled defaultValue="byContrib" style={{ padding: 10, borderRadius: 10, background: "var(--glass)", color: "var(--text)", border: "1px solid var(--glass-border)" }}>
              <option value="equal">Поровну</option>
              <option value="byContrib">По вкладам</option>
              <option value="manual">Вручную</option>
            </select>
          </div>
        </div>

        {participants.map((p) => {
          const share = shares.find((s) => s.participantId === p.id);
          const contrib = contributions.find((c) => c.participantId === p.id)?.amount ?? 0;
          return (
            <div key={p.id} className="card" style={{ padding: 12, display: "grid", gap: 10 }}>
              <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", justifyContent: "space-between" }}>
                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", minWidth: 0, width: '100%' }}>
                  <input value={p.name} disabled style={{ padding: 10, borderRadius: 10, background: "var(--glass)", color: "var(--text)", border: "1px solid var(--glass-border)", minWidth: 0, flex: "1 1 220px" }} />
                  <select value={p.role} disabled style={{ padding: 10, borderRadius: 10, background: "var(--glass)", color: "var(--text)", border: "1px solid var(--glass-border)", minWidth: 0, flex: "0 1 200px" }}>
                    <option value="member">Участник</option>
                    <option value="holder">Держатель билета</option>
                  </select>
                </div>
              </div>
              <div style={{ display: "grid", gap: 8 }}>
                <label style={{ display: "grid", gap: 6 }}>
                  <span className="small">Email</span>
                  <input type="email" value={p.email} disabled style={{ padding: 10, borderRadius: 10, background: "var(--glass)", color: "var(--text)", border: "1px solid var(--glass-border)", width: "100%" }} />
                </label>
              </div>
              <div style={{ display: "grid", gap: 8, gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))" }}>
                <label style={{ display: "grid", gap: 6 }}>
                  <span className="small">Вклад (сумма)</span>
                  <input type="number" value={contrib} disabled style={{ padding: 10, borderRadius: 10, background: "var(--glass)", color: "var(--text)", border: "1px solid var(--glass-border)", width: "100%" }} />
                </label>
                <label style={{ display: "grid", gap: 6 }}>
                  <span className="small">Доля, %</span>
                  <input type="number" value={(share?.percent ?? 0).toFixed(2)} disabled style={{ padding: 10, borderRadius: 10, background: "var(--glass)", color: "var(--text)", border: "1px solid var(--glass-border)", width: "100%" }} />
                </label>
                <label style={{ display: "grid", gap: 6 }}>
                  <span className="small">Доля от банка</span>
                  <input readOnly value={`$${((share?.amount ?? 0)).toFixed(2)}`} disabled style={{ padding: 10, borderRadius: 10, background: "var(--glass)", color: "var(--text)", border: "1px solid var(--glass-border)", width: "100%" }} />
                </label>
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ display: "flex", gap: 12, alignItems: "center", justifyContent: "space-between", flexWrap: "wrap" }}>
        <div className="small">Банк: ${bank.toFixed(2)} • Сумма вкладов: ${contribSum.toFixed(2)}</div>
        <div className="sticky-panel">
          <button className="btn btn--primary" onClick={() => setShowAgreement(true)} disabled={!(ticketsValid && bankMatches && emailsValid)} aria-disabled={!(ticketsValid && bankMatches && emailsValid)}>
            Показать договор (демо)
          </button>
        </div>
      </div>

      {showAgreement && (
        <div role="dialog" aria-modal className="card" style={{ position: 'fixed', inset: 0, background: 'rgba(11,15,26,0.8)', backdropFilter: 'blur(3px)', display: 'grid', placeItems: 'center', zIndex: 1000 }}>
          <div ref={agreementRef} className="card" style={{ padding: 20, maxWidth: 900, width: '90vw', maxHeight: '85vh', overflow: 'auto', display: 'grid', gap: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
              <h3 style={{ margin: 0 }} tabIndex={-1}>Соглашение о совместном участии в лотерейном пуле (демо)</h3>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn--primary" onClick={() => setShowAgreement(false)}>Закрыть</button>
              </div>
            </div>

            {/* Реквизиты */}
            <div className="card" style={{ padding: 16, display: 'grid', gap: 6 }}>
              <div className="small">Пул: <strong>Демо пул</strong></div>
              <div className="small">Тираж: <strong>{new Date(poolLike.drawDateISO).toLocaleString()}</strong> • Лотерея: Powerball (США)</div>
              <div className="small">Юрисдикция: Содружество Пенсильвания, США</div>
              <div className="small">Банк (стоимость билетов): <strong>${bank.toFixed(2)}</strong></div>
            </div>

            {/* Стороны */}
            <div className="card" style={{ padding: 16, display: 'grid', gap: 6 }}>
              <h4 style={{ margin: 0 }}>Стороны</h4>
              <div className="small">Держатель билета: <strong>{participants.find(p=>p.role==='holder')?.name || '—'}</strong> ({participants.find(p=>p.role==='holder')?.email || '—'})</div>
              <div className="small">Участники: см. Приложение B.</div>
            </div>

            {/* Покупка и хранение билетов */}
            <div className="card" style={{ padding: 16, display: 'grid', gap: 6 }}>
              <h4 style={{ margin: 0 }}>Покупка и хранение билетов</h4>
              <div className="small">Держатель покупает билеты у официального ритейлера или через официальный канал соответствующего штата, находясь физически в Пенсильвании или в другом штате, где присутствует официальный ритейлер. Оригиналы билетов хранятся у держателя до закрытия пула.</div>
            </div>

            {/* Вклады, банк и доли */}
            <div className="card" style={{ padding: 16, display: 'grid', gap: 6 }}>
              <h4 style={{ margin: 0 }}>Вклады, банк и доли</h4>
              <div className="small">Сумма вкладов участников должна равняться Банку (стоимости всех билетов). Сверка обязательна до финализации.</div>
              <div className="small">Доли участников рассчитываются в режиме “по вкладам” (демо). В рабочем пуле доступны режимы: поровну, по вкладам, вручную.</div>
            </div>

            {/* Заявление выигрыша и выплаты */}
            <div className="card" style={{ padding: 16, display: 'grid', gap: 6 }}>
              <h4 style={{ margin: 0 }}>Заявление выигрыша и выплаты</h4>
              <div className="small">Держатель заявляет выигрыш по правилам штата и оператора лотереи. Чистая сумма после удержания налогов распределяется по долям в разумный срок (как правило, до 15 рабочих дней после получения средств).</div>
              <div className="small">Возможные расходы на получение выигрыша и банковские комиссии могут компенсироваться из Банка или из чистой суммы по согласию участников.</div>
            </div>

            {/* Иностранные участники */}
            <div className="card" style={{ padding: 16, display: 'grid', gap: 6 }}>
              <h4 style={{ margin: 0 }}>Иностранные участники</h4>
              <div className="small">Выплаты нерезидентам США осуществляются как выплаты по договорённости; возможны требования отчётности и налоговые последствия в США и стране получателя. Участники предоставляют необходимые данные/формы для законной выплаты.</div>
            </div>

            {/* Заявления и гарантии */}
            <div className="card" style={{ padding: 16, display: 'grid', gap: 6 }}>
              <h4 style={{ margin: 0 }}>Заявления и гарантии</h4>
              <div className="small">18+. Игра на собственный риск. Шансы на крупный выигрыш низкие; отсутствуют гарантии выигрыша.</div>
              <div className="small">Данный демо‑документ не является юридической или налоговой консультацией. В рабочем режиме рекомендуем хранить копию договора и при существенных суммах консультироваться с CPA/юристом.</div>
            </div>

            {/* Прозрачность и верификация */}
            <div className="card" style={{ padding: 16, display: 'grid', gap: 6 }}>
              <h4 style={{ margin: 0 }}>Прозрачность и верификация</h4>
              <div className="small">В рабочем договоре мы добавляем контрольный дайджест данных пула (SHA‑256) и QR‑код/ссылку для быстрой проверки состава билетов и участников. В демо эти элементы опущены — показана только структура документа.</div>
            </div>

            {/* Приложение A */}
            <div className="card" style={{ padding: 16, display: 'grid', gap: 6 }}>
              <h4 style={{ margin: 0 }}>Приложение A. Билеты</h4>
              <div className="small">Цена за билет: ${pricePer.toFixed(2)} • Итого билетов: {tickets.length} • Банк: ${bank.toFixed(2)}</div>
              <div className="small">Билет #1: {tickets[0].numbers.join(' ')} • PB {tickets[0].power ?? '-'}</div>
            </div>

            {/* Приложение B */}
            <div className="card" style={{ padding: 16, display: 'grid', gap: 6 }}>
              <h4 style={{ margin: 0 }}>Приложение B. Участники и доли</h4>
              <div className="small" style={{ display: 'grid', gap: 6 }}>
                {participants.map((p)=>{
                  const s = shares.find(x=>x.participantId===p.id); const a = contributions.find(c=>c.participantId===p.id)?.amount ?? 0;
                  return <div key={p.id}>• {p.name || '—'} ({p.email || '—'}) — вклад ${a.toFixed(2)}, доля {(s?.percent ?? 0).toFixed(2)}%, от банка ${((s?.amount ?? 0)).toFixed(2)}</div>;
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
