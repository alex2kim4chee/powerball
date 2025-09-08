"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Script from "next/script";
import { useRouter } from "next/navigation";
import { listPools, getContributionTotal } from "../lib/pool";

function useLatestPool() {
  const [poolId, setPoolId] = useState<string | null>(null);
  useEffect(() => {
    try {
      const pools = listPools();
      if (pools.length > 0) setPoolId(pools[0].id);
    } catch {}
  }, []);
  return poolId;
}

function useProgress(poolId: string | null) {
  const [progress, setProgress] = useState({
    hasPool: false,
    ticketsValid: false,
    emailsValid: false,
    bankMatches: false,
  });

  useEffect(() => {
    if (!poolId) return;
    try {
      const pools = listPools();
      const pool = pools.find((p) => p.id === poolId);
      if (!pool) return;
      const ticketsValid = (pool.tickets || []).every((t) => t.numbers?.length === 5 && t.power != null);
      const pricePer = pool.pricePer || 0;
      const bank = (pool.tickets?.length || 0) * pricePer;
      const contribSum = (pool.participants || []).reduce((s, p) => s + (getContributionTotal(pool, p.id) || 0), 0);
      const bankMatches = Math.abs(bank - contribSum) <= 0.01;
      const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      const emailsValid = (pool.participants || []).length > 0 && (pool.participants || []).every((p) => !!p.email && emailRe.test(p.email));
      setProgress({ hasPool: true, ticketsValid, emailsValid, bankMatches });
    } catch {}
  }, [poolId]);

  return progress;
}

export default function HowItWorks() {
  const router = useRouter();
  const latestPoolId = useLatestPool();
  const progress = useProgress(latestPoolId);

  const importRef = useRef<HTMLInputElement | null>(null);
  const openImport = () => importRef.current?.click();
  const onImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.currentTarget;
    const f = input.files?.[0];
    if (!f) return;
    try {
      const { importPoolFromFile } = await import("../lib/pool");
      const imported = await importPoolFromFile(f);
      if (!imported) {
        alert("Не удалось импортировать пул: неверный файл или формат.");
      } else {
        try { input.value = ""; } catch {}
        router.replace(`/pool/${imported.id}`);
        return;
      }
    } catch {
      alert("Не удалось импортировать пул.");
    } finally {
      try { input.value = ""; } catch {}
    }
  };

  const steps = useMemo(() => [
    {
      n: 1,
      t: "Создайте или импортируйте пул",
      d: "Задайте название, дату тиража и стартовые билеты — или восстановите из файла/ссылки.",
    },
    {
      n: 2,
      t: "Добавьте участников",
      d: "Укажите имена и email. Назначьте держателя билета (штат с официальным ритейлером).",
      hint: "Email обязателен: это уникальная подпись участника.",
      ok: progress.hasPool && progress.emailsValid,
    },
    {
      n: 3,
      t: "Заполните билеты",
      d: "Выберите 5 чисел и PowerBall для каждого билета.",
      ok: progress.hasPool && progress.ticketsValid,
    },
    {
      n: 4,
      t: "Укажите вклады и доли",
      d: "Внесите суммы вкладов и выберите режим долей: поровну, по вкладам или вручную.",
    },
    {
      n: 5,
      t: "Сверка и проверки",
      d: "Система проверит равенство вкладов и банка, валидность email и заполненность билетов.",
      ok: progress.hasPool && progress.bankMatches,
    },
    {
      n: 6,
      t: "Договор и обмен",
      d: "Сгенерируйте договор (PDF) и поделитесь ссылкой/QR для восстановления пула.",
    },
  ], [progress]);

  const howToJson = useMemo(() => ({
    "@context": "https://schema.org",
    "@type": "HowTo",
    name: "Как создать лотерейный пул и оформить договор",
    step: steps.map((s) => ({
      "@type": "HowToStep",
      position: s.n,
      name: `${s.n}. ${s.t}`,
      text: s.d,
    })),
  }), [steps]);

  return (
    <div>
      <Script id="ld-howto" type="application/ld+json" strategy="afterInteractive"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(howToJson) }} />

      <div className="grid" style={{ gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))" }} role="list">
        {steps.map((s) => (
          <div key={s.n} role="listitem" className="card" style={{ padding: 20, display: "grid", gap: 8 }}>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
              <h3 style={{ margin: 0 }}><span style={{ opacity: 0.6 }}>{s.n}.</span> {s.t}</h3>
              {s.ok && (
                <span aria-label="Готово" title="Готово" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 22, height: 22, borderRadius: 6, background: 'rgba(0,245,212,0.12)', border: '1px solid rgba(0,245,212,0.45)', boxShadow: 'inset 0 0 8px rgba(0,245,212,0.25)' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
                    <path d="M20 6L9 17L4 12" stroke="#00F5D4" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </span>
              )}
            </div>
            <p style={{ margin: 0, color: "var(--text-dim)" }}>{s.d}</p>
            {s.hint && <div className="small" style={{ color: "var(--text-dim)" }}>{s.hint}</div>}
          </div>
        ))}
      </div>

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 12 }}>
        <a className="btn btn--primary" href="/pool/new">Создать пул</a>
        <button className="btn btn--ghost" onClick={openImport} type="button">Импорт пула</button>
        <input ref={importRef} onChange={onImport} type="file" accept="application/json" style={{ display: "none" }} />
        {latestPoolId && <a className="btn btn--ghost" href={`/pool/${latestPoolId}`}>Открыть последний пул</a>}
      </div>
      <div className="small" style={{ color: "var(--text-dim)", marginTop: 8 }}>
        Мы не продаём билеты; держатель покупает их у официального ритейлера/канала штата, находясь в Пенсильвании или другом штате с официальным ритейлером.
      </div>
    </div>
  );
}
