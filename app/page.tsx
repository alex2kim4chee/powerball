"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { importPoolFromFile } from "../lib/pool";
import NumberPicker from "../components/NumberPicker";
import HowItWorks from "../components/HowItWorks";
import DemoPool from "../components/DemoPool";
import type { Selection } from "../lib/pool";
import { makeEmptySelection, makeRandomSelection } from "../lib/pool";

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
    const d = new Date();
    d.setSeconds(0, 0);
    // Today 23:00 local, or tomorrow if past
    const target = new Date(d);
    target.setHours(23, 0, 0, 0);
    if (d.getTime() > target.getTime()) target.setDate(target.getDate() + 1);
    return target;
  }, []);
  return next;
}

function AnimatedCounter({ from = 100_000_000, to = 142_000_000, duration = 8000 }: { from?: number; to?: number; duration?: number }) {
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
  const str = `$${val.toLocaleString("en-US")}`;
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

// NumberPicker and selection utils moved to components/NumberPicker and lib/pool

export default function Page() {
  const router = useRouter();
  const target = NextDrawDate();
  const [selections, setSelections] = useState<Selection[]>([makeEmptySelection()]);
  const [tickets, setTickets] = useState<number>(1);
  const pricePer = 5; // demo
  const allValid = selections.every((s) => s.numbers.length === 5 && s.power != null);
  const total = selections.length * pricePer;

  const buy = () => {
    if (!allValid) {
      alert("Заполните все билеты: выберите 5 чисел и 1 PowerBall в каждом");
      return;
    }
    alert(`Демо: ${selections.length} бил. на сумму $${total}.\n\nБилеты:\n${selections.map((s,i)=>`#${i+1}: ${s.numbers.join(" ")} PB ${s.power}`).join("\n")}`);
  };

  // Smooth scroll to a ticket when added/removed
  const ticketRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [pendingScrollIndex, setPendingScrollIndex] = useState<number | null>(null);
  useEffect(() => {
    if (pendingScrollIndex == null) return;
    const el = ticketRefs.current[pendingScrollIndex];
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start", inline: "nearest" });
    }
    const id = window.setTimeout(() => setPendingScrollIndex(null), 300);
    return () => window.clearTimeout(id);
  }, [pendingScrollIndex, selections.length]);

  const addTicket = () => {
    if (selections.length >= 10) return;
    setPendingScrollIndex(selections.length); // scroll to new last ticket
    setSelections((prev) => [...prev, makeEmptySelection()]);
    setTickets((t) => Math.min(10, t + 1));
  };

  const removeTicket = () => {
    if (selections.length <= 1) return;
    // After removal, previous ticket becomes last: index = length - 2
    setPendingScrollIndex(Math.max(0, selections.length - 2));
    setSelections((prev) => prev.slice(0, -1));
    setTickets((t) => Math.max(1, t - 1));
  };

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
              PowerBall на русском — шанс на миллионы уже сегодня
            </h1>
            <p style={{ color: "var(--text-dim)", margin: 0 }}>
              Выберите числа за 30 секунд. Следующий тираж через <Countdown target={target} />. Текущий джекпот:
            </p>
            <div suppressHydrationWarning>
              <AnimatedCounter />
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
