"use client";

import { useEffect, useMemo, useRef, useState } from "react";

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

type Selection = { numbers: number[]; power: number | null };

function makeEmptySelection(): Selection { return { numbers: [], power: null }; }
function makeRandomSelection(): Selection {
  const all = Array.from({ length: 69 }, (_, i) => i + 1);
  const nums: number[] = [];
  while (nums.length < 5) {
    const i = Math.floor(Math.random() * all.length);
    const n = all.splice(i, 1)[0];
    nums.push(n);
  }
  const p = Math.floor(Math.random() * 26) + 1;
  return { numbers: nums.sort((a, b) => a - b), power: p };
}

function NumberPicker({ value, onChange, title }: { value: Selection; onChange: (s: Selection) => void; title?: string }) {
  const selected = value;

  const toggle = (n: number) => {
    const exists = selected.numbers.includes(n);
    if (exists) onChange({ ...selected, numbers: selected.numbers.filter((x) => x !== n) });
    else if (selected.numbers.length < 5) onChange({ ...selected, numbers: [...selected.numbers, n].sort((a, b) => a - b) });
  };
  const setPower = (n: number) => onChange({ ...selected, power: n });

  const randomize = () => onChange(makeRandomSelection());
  const hot = () => randomize();
  const cold = () => randomize();

  return (
    <div className="card" style={{ padding: 20 }}>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", minWidth: 0 }}>
        <h3 style={{ margin: 0 }}>{title ?? "Выберите числа"}</h3>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button className="btn btn--ghost" onClick={randomize}>Случайно</button>
          <button className="btn btn--ghost" onClick={hot}>Горячие</button>
          <button className="btn btn--ghost" onClick={cold}>Холодные</button>
        </div>
      </div>
      <div style={{ marginTop: 10, color: "var(--text-dim)" }}>Отметьте 5 чисел (1–69) и 1 PowerBall (1–26)</div>
      <div className="chips" style={{ marginTop: 16 }}>
        {Array.from({ length: 69 }, (_, i) => i + 1).map((n) => (
          <button
            key={n}
            className={`chip ${selected.numbers.includes(n) ? "chip--active" : ""}`}
            onClick={() => toggle(n)}
            aria-pressed={selected.numbers.includes(n)}
            aria-label={`Число ${n}`}
          >
            {n}
          </button>
        ))}
      </div>

      <div style={{ marginTop: 20, marginBottom: 15, color: "var(--text-dim)" }}>PowerBall (1–26)</div>
      <div className="chips">
        {Array.from({ length: 26 }, (_, i) => i + 1).map((n) => (
          <button
            key={n}
            className={`chip chip--power ${selected.power === n ? "chip--active" : ""}`}
            onClick={() => setPower(n)}
            aria-pressed={selected.power === n}
            aria-label={`PowerBall ${n}`}
          >
            {n}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function Page() {
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
              <a className="btn btn--primary" href="#buy">Купить билет сейчас</a>
              <a className="btn btn--ghost" href="#how">Как это работает?</a>
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
          <div className="grid grid-3" style={{ gap: 16 }}>
            {[{
              t: "Выберите 5 чисел и PowerBall",
              d: "Карточки-шары, быстрый выбор \"Случайно\".",
            },{
              t: "Оплатите безопасно",
              d: "Поддержка популярных платёжных систем.",
            },{
              t: "Получите электронный билет",
              d: "QR/ID, уведомление о результате.",
            }].map((x, i) => (
              <div key={i} className="card tilt" style={{ padding: 20 }}>
                <h3 style={{ marginTop: 0 }}>{x.t}</h3>
                <p style={{ color: "var(--text-dim)" }}>{x.d}</p>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 12 }} className="card" role="region" aria-label="FAQ кратко">
            <div style={{ padding: 16, display: "flex", gap: 24, flexWrap: "wrap", color: "var(--text-dim)" }}>
              <span>Где смотреть результаты?</span>
              <span>Как получить выигрыш?</span>
              <span>Сколько стоит участие?</span>
            </div>
          </div>
        </div>
      </section>

      {/* Buy section */}
      <section id="buy" className="section">
        <div className="container" style={{ display: "grid", gridTemplateColumns: "1fr", gap: 16 }}>
          <div className="card" style={{ padding: 20 }}>
            <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", minWidth: 0 }}>
              <div>
                <h2 style={{ margin: 0 }}>Текущий тираж</h2>
                <div className="small">Дата: сегодня, <span suppressHydrationWarning>{target.toLocaleDateString()}</span> • Джекпот растёт • Цена билета ${pricePer}</div>
              </div>
              <div className="countdown"><Countdown target={target} /></div>
            </div>
            <div style={{ marginTop: 16, display: "grid", gap: 12 }}>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", minWidth: 0 }}>
                <div className="small">Количество билетов: {selections.length}</div>
                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                  <button className="btn btn--ghost" onClick={() => setSelections((prev) => prev.map(() => makeRandomSelection()))}>Заполнить все случайно</button>
                  <button className="btn btn--ghost" onClick={() => setSelections((prev) => prev.map(() => makeEmptySelection()))}>Очистить все</button>
                </div>
              </div>
              {selections.map((sel, i) => (
                <div key={i} ref={(el) => (ticketRefs.current[i] = el)}>
                  <NumberPicker value={sel} onChange={(s) => setSelections((prev) => prev.map((p, idx) => (idx === i ? s : p)))} title={`Билет #${i + 1}`} />
                </div>
              ))}
            </div>
            <div style={{ display: "flex", gap: 12, alignItems: "center", justifyContent: "space-between", marginTop: 16, flexWrap: "wrap", minWidth: 0 }}>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                <button className="btn btn--ghost" onClick={addTicket} disabled={selections.length >= 10} aria-disabled={selections.length >= 10}>Добавить билет</button>
                <button className="btn btn--ghost" onClick={removeTicket} disabled={selections.length <= 1} aria-disabled={selections.length <= 1}>Удалить</button>
                <span className="small">Всего: {selections.length}</span>
              </div>
              <div className="sticky-panel">
                <button className="btn btn--primary" onClick={buy} disabled={!allValid} aria-disabled={!allValid}>
                  К оплате — ${total}
                </button>
              </div>
            </div>
          </div>

          {/* Promotions */}
          <div className="card" style={{ padding: 20, display: "grid", gap: 12 }}>
            <h3 style={{ marginTop: 0 }}>Бонусы и акции</h3>
            <div className="grid grid-2" style={{ gap: 12 }}>
              <div className="card tilt" style={{ padding: 16 }}>-10% на первый билет</div>
              <div className="card tilt" style={{ padding: 16 }}>2+1 бесплатно по промокоду POWER</div>
            </div>
            <div className="small">Каждый 5-й билет — со скидкой</div>
          </div>

          {/* Winners */}
          <div className="card" style={{ padding: 0 }}>
            <div className="marquee">
              <div className="marquee__inner" aria-hidden>
                {Array.from({ length: 20}).map((_,i) => (
                  <span key={i} style={{ display: "inline-block", padding: "14px 28px", color: "var(--text-dim)" }}>
                    {i%2?"Антон К., Нью-Йорк — $5,000":"Ольга S., Торонто — $500"}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Security */}
          <div className="card" style={{ padding: 20, display: "grid", gap: 10 }}>
            <h3 style={{ marginTop: 0 }}>Безопасность и прозрачность</h3>
            <div className="small">PCI DSS • Шифрование • KYC. Ссылка на правила и шансы, возвраты, поддержка.</div>
          </div>

          {/* FAQ */}
          <div className="card" style={{ padding: 20 }}>
            <h3 style={{ marginTop: 0 }}>FAQ</h3>
            <details>
              <summary>Это официальный Powerball?</summary>
              <div className="small">Нет. Сайт не связан и не аффилирован с Multi-State Lottery Association.</div>
            </details>
            <details>
              <summary>Как получить выигрыш?</summary>
              <div className="small">Мы отправим инструкцию по выводу на указанный email.</div>
            </details>
            <details>
              <summary>Сколько стоит участие?</summary>
              <div className="small">Демо-цена — ${pricePer} за билет.</div>
            </details>
          </div>
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
