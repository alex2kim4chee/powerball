"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { importPoolFromFile } from "../lib/pool";
import HowItWorks from "../components/HowItWorks";
import DemoPool from "../components/DemoPool";

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
  return { days, hours, minutes, seconds, isOver: diff <= 0 };
}

function NextDrawDate() {
  const next = useMemo(() => {
    const tz = "America/New_York"; // ET
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

    // Helper: build Date for specific wall time in ET
    const makeEtDate = (y: number, m: number, d: number, hh: number, mm: number, ss = 0) => {
      const utcGuess = Date.UTC(y, m - 1, d, hh, mm, ss);
      const parts = parseParts(new Date(utcGuess));
      const gotMs = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second);
      const desiredMs = Date.UTC(y, m - 1, d, hh, mm, ss);
      const finalMs = utcGuess - (gotMs - desiredMs);
      return new Date(finalMs);
    };

    const now = new Date();
    const p = parseParts(now);
    const y = +p.year, m = +p.month, d = +p.day, H = +p.hour, M = +p.minute;
    const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0=Sun..6=Sat, for ET civil date

    const isDrawDay = dow === 1 || dow === 3 || dow === 6; // Mon, Wed, Sat
    const beforeCutoff = H < 22 || (H === 22 && M < 59);

    const addDays = (yy: number, mm: number, dd: number, add: number) => {
      const t = new Date(Date.UTC(yy, mm - 1, dd));
      t.setUTCDate(t.getUTCDate() + add);
      return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate() };
    };

    let ty = y, tm = m, td = d;
    if (!(isDrawDay && beforeCutoff)) {
      let add = isDrawDay ? 1 : 0;
      // advance to next draw weekday
      while (true) {
        add += 1;
        const nd = addDays(y, m, d, add - 1);
        const ndow = new Date(Date.UTC(nd.y, nd.m - 1, nd.d)).getUTCDay();
        if (ndow === 1 || ndow === 3 || ndow === 6) { ty = nd.y; tm = nd.m; td = nd.d; break; }
      }
    }

    // Draw time 22:59 ET
    return makeEtDate(ty, tm, td, 22, 59, 0);
  }, []);
  return next;
}

function AnimatedCounter({ from = 100_000_000, to = 142_000_000, duration = 8000, format = "money" as "money" | "million" }: { from?: number; to?: number; duration?: number; format?: "money" | "million" }) {
  const [val, setVal] = useState(from);
  const startRef = useRef<number | null>(null);
  useEffect(() => {
    let raf = 0;
    const step = (t: number) => {
      if (startRef.current == null) startRef.current = t;
      const p = Math.min(1, (t - startRef.current) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setVal(Math.floor(from + (to - from) * eased));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [from, to, duration]);
  const str = format === "million"
    ? `$${Math.round(val / 1_000_000).toLocaleString("en-US")} Million`
    : `$${val.toLocaleString("en-US")}`;
  return <div className="odometer" aria-live="polite">{str}</div>;
}

function Countdown({ target }: { target: Date }) {
  // Avoid SSR/client time mismatch and invalid <div> inside <p>
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const { days, hours, minutes, seconds } = useCountdown(target);
  const pad = (n: number) => n.toString().padStart(2, "0");
  if (!mounted) {
    return (
      <span className="countdown" aria-hidden>
        --д&nbsp;--ч&nbsp;--м&nbsp;--с
      </span>
    );
  }
  return (
    <span className="countdown" role="timer" aria-live="polite" aria-label="Таймер до следующего тиража">
      {days > 0 && (<><strong>{pad(days)}</strong>д&nbsp;</>)}
      <strong>{pad(hours)}</strong>ч&nbsp;
      <strong>{pad(minutes)}</strong>м&nbsp;
      <strong>{pad(seconds)}</strong>с
    </span>
  );
}

export default function Page() {
  const router = useRouter();
  const target = NextDrawDate();
  // Import pool from home page
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const openImport = () => importInputRef.current?.click();
  const onImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.currentTarget;
    const f = input.files?.[0];
    if (!f) return;
    try {
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

  return (
    <main>
      {/* Hero */}
      <section className="hero section">
        <div className="hero__bg">
          <div className="hero__rays" />
        </div>
        <div className="container grid grid-hero">
          <div className="hero__text" style={{ display: "grid", gap: 18, alignContent: "center" }}>
            <h1 className="hero__h1" style={{ fontSize: "clamp(22px, 5.5vw, 48px)", margin: 0 }}>
              Играйте командой. Прозрачный лотерейный пул для Powerball.
            </h1>
            <p style={{ color: "var(--text-dim)", margin: 0 }}>
              Выберите числа, добавьте участников, укажите вклады — система проверит, подпишет и подготовит договор. Следующий тираж через <Countdown target={target} />.
            </p>
            <div suppressHydrationWarning>
              <AnimatedCounter from={32_000_000} to={33_000_000} duration={1500} />
            </div>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <a className="btn btn--primary" href="/pool/new">Создать пул</a>
              <a className="btn btn--ghost" href="#how">Как это работает?</a>
              <button className="btn btn--ghost" onClick={openImport} type="button">Импорт пула</button>
              <input ref={importInputRef} onChange={onImportFile} type="file" accept="application/json" style={{ display: "none" }} />
            </div>
            <div className="small">18+ | Играйте ответственно | Сайт не связан и не аффилирован с Multi-State Lottery Association. Товарный знак Powerball принадлежит его правообладателю.</div>
          </div>
          <div className="hero__visual center">
            <div className="orb tilt">
              <div className="orb__gloss" />
              <OrbLabel text="PowerBall" />
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="section">
        <div className="container">
          <h2 style={{ marginTop: 0 }}>Как это работает</h2>
          <HowItWorks />
        </div>
      </section>

      {/* Demo section */}
      <section id="buy" className="section">
        <div className="container">
          <DemoPool />
        </div>
      </section>

      {/* Footer */}
      <footer className="section" style={{ paddingTop: 32 }}>
        <div className="container" style={{ display: "grid", gap: 12 }}>
          <div className="small">18+ • Играйте ответственно • Гео-ограничения применяются • Возможны налоги в вашей стране.</div>
          <div className="small">Сайт не связан и не аффилирован с Multi-State Lottery Association. Товарный знак Powerball принадлежит его правообладателю.</div>
          <div className="small">© PowerBall RU, <span suppressHydrationWarning>{new Date().getFullYear()}</span> • Контакты • Политика конфиденциальности • Условия</div>
        </div>
      </footer>
    </main>
  );
}

function OrbLabel({ text }: { text: string }) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const textRef = useRef<HTMLDivElement | null>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const calc = () => {
      const wrap = wrapRef.current?.parentElement; // .orb
      const el = textRef.current;
      if (!wrap || !el) return;
      // целевая ширина = 1/3 ширины шара
      const orbWidth = wrap.getBoundingClientRect().width;
      if (orbWidth === 0) return;
      // сбрасываем масштаб перед измерением
      el.style.transform = "scale(1)";
      const textWidth = el.getBoundingClientRect().width;
      if (textWidth === 0) return;
      // Уменьшаем на 15% от текущего большого размера: 160% → 136%
      const target = orbWidth * 1.36;
      let k = target / textWidth; // разрешаем upscaling (>1)
      // На мобильных делаем надпись на 15% меньше
      if (typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(max-width: 480px)').matches) {
        k *= 0.85;
      }
      setScale(k);
    };
    calc();
    const ro = new ResizeObserver(calc);
    if (wrapRef.current?.parentElement) ro.observe(wrapRef.current.parentElement);
    if (textRef.current) ro.observe(textRef.current);
    const id = setTimeout(calc, 100); // повтор после загрузки шрифтов
    return () => { ro.disconnect(); clearTimeout(id); };
  }, []);

  return (
    <div className="orb__labelWrap" ref={wrapRef} aria-hidden>
      <div ref={textRef} className="orb__label" style={{ transform: `scale(${scale})` }}>{text}</div>
    </div>
  );
}
