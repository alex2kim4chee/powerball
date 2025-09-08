"use client";

import React from "react";
import type { Selection } from "../lib/pool";
import { makeRandomSelection } from "../lib/pool";

export default function NumberPicker({ value, onChange, title }: { value: Selection; onChange: (s: Selection) => void; title?: string }) {
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

