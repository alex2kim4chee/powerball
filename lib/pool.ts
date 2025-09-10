"use client";

// Minimal client-side storage for Pools using localStorage

export type Selection = { numbers: number[]; power: number | null };

export function makeEmptySelection(): Selection {
  return { numbers: [], power: null };
}

export function makeRandomSelection(): Selection {
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

// Heuristics for "hot" and "cold" picks (demo, not predictive)
function weightedSampleDistinct(max: number, k: number, weight: (n: number) => number): number[] {
  const pool = Array.from({ length: max }, (_, i) => i + 1);
  const selected: number[] = [];
  for (let t = 0; t < k && pool.length > 0; t++) {
    const weights = pool.map((n) => Math.max(0.0001, weight(n)));
    const total = weights.reduce((s, x) => s + x, 0);
    let r = Math.random() * total;
    let idx = 0;
    for (; idx < pool.length; idx++) {
      r -= weights[idx];
      if (r <= 0) break;
    }
    const n = pool.splice(Math.min(idx, pool.length - 1), 1)[0];
    selected.push(n);
  }
  return selected;
}

function triangular(center: number, spread: number) {
  return (n: number) => Math.max(0, 1 - Math.abs(n - center) / spread);
}

export function makeHotSelection(): Selection {
  // Bias towards central numbers and human-popular patterns (multiples of 7/10)
  const centerW = triangular(35, 30);
  const weight69 = (n: number) => centerW(n) * (1 + (n % 7 === 0 ? 0.25 : 0) + (n % 10 === 0 ? 0.15 : 0));
  const nums = weightedSampleDistinct(69, 5, weight69).sort((a, b) => a - b);
  const weight26 = triangular(13, 10);
  // Slight bonus to 7, 11, 17 as perceived "hot" numbers in folklore
  const wPB = (n: number) => weight26(n) * (1 + ([7, 11, 17].includes(n) ? 0.2 : 0));
  const [power] = weightedSampleDistinct(26, 1, wPB);
  return { numbers: nums, power: power ?? 13 };
}

export function makeColdSelection(): Selection {
  // Bias towards higher numbers (less likely chosen by humans) and avoid popular ones
  const unpopularEnding = (n: number) => ([7, 13].includes(n) || n % 5 === 0) ? 0.6 : 1;
  const weight69 = (n: number) => (
    // Prefer > 31 (не "даты") и верхний диапазон
    (n > 31 ? 1.6 : 0.8) * (n / 69) * unpopularEnding(n)
  );
  const nums = weightedSampleDistinct(69, 5, weight69).sort((a, b) => a - b);
  // PowerBall: two-peak towards extremes, avoid 7/13/21
  const avoid = new Set([7, 13, 21]);
  const weight26 = (n: number) => (n <= 4 || n >= 22 ? 1.8 : 0.7) * (avoid.has(n) ? 0.5 : 1);
  const [power] = weightedSampleDistinct(26, 1, weight26);
  return { numbers: nums, power: power ?? 1 };
}

export type Role = "holder" | "member";

export type Participant = {
  id: string;
  name: string;
  role: Role;
  email?: string;
  note?: string;
};

export type Contribution = {
  id: string;
  participantId: string;
  amount: number; // in currency units, e.g. USD
  createdAt: string;
};

export type ShareMode = "equal" | "byContrib" | "manual";

export type ManualOverrides = Record<string, number>; // participantId -> percent (0..100)

export type Pool = {
  id: string;
  name: string;
  drawDateISO: string; // ISO string for date/time of draw
  pricePer: number;
  tickets: Selection[];
  participants: Participant[];
  contributions: Contribution[];
  shareMode: ShareMode;
  manualOverrides?: ManualOverrides;
  createdAt: string;
  updatedAt: string;
};

const KEY = "pools";

type PoolsMap = Record<string, Pool>;

function readMap(): PoolsMap {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") return parsed as PoolsMap;
    return {};
  } catch {
    return {};
  }
}

function writeMap(map: PoolsMap) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, JSON.stringify(map));
}

export function listPools(): Pool[] {
  const map = readMap();
  return Object.values(map).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function getPool(id: string): Pool | null {
  const map = readMap();
  return map[id] ?? null;
}

export function savePool(pool: Pool) {
  const map = readMap();
  map[pool.id] = { ...pool, updatedAt: new Date().toISOString() };
  writeMap(map);
}

export function createPool(input: { name: string; drawDate: Date; pricePer?: number; initialTickets?: number }): Pool {
  const id = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(36).slice(2, 8);
  const now = new Date().toISOString();
  const pricePer = input.pricePer ?? 5;
  const initialTickets = Math.max(1, Math.min(10, input.initialTickets ?? 1));
  const tickets = Array.from({ length: initialTickets }, () => makeEmptySelection());
  const pool: Pool = {
    id,
    name: input.name.trim() || "Без названия",
    drawDateISO: input.drawDate.toISOString(),
    pricePer,
    tickets,
    participants: [],
    contributions: [],
    shareMode: "equal",
    createdAt: now,
    updatedAt: now,
  };
  savePool(pool);
  return pool;
}

export function updatePoolTickets(id: string, tickets: Selection[]) {
  const pool = getPool(id);
  if (!pool) return;
  pool.tickets = tickets;
  savePool(pool);
}

export function exportPool(pool: Pool): Blob {
  const data = {
    type: "powerball.ru/pool",
    version: 2,
    exportedAt: new Date().toISOString(),
    pool,
  };
  const json = JSON.stringify(data, null, 2);
  return new Blob([json], { type: "application/json" });
}

export async function importPoolFromFile(file: File): Promise<Pool | null> {
  const text = await file.text();
  try {
    const data = JSON.parse(text);
    if (!data || data.type !== "powerball.ru/pool" || !data.pool) return null;
    const raw = data.pool as Partial<Pool> & { id: string };
    // Если пул с таким id уже существует локально — создаём копию с новым id, не затирая существующий
    const exists = getPool(raw.id);
    const newId = (typeof crypto !== "undefined" && "randomUUID" in crypto) ? crypto.randomUUID() : (raw.id + "-" + Math.random().toString(36).slice(2, 8));
    const assignedId = exists ? newId : raw.id;
    const now = new Date().toISOString();
    const pool: Pool = {
      id: assignedId,
      name: raw.name ?? "Без названия",
      drawDateISO: raw.drawDateISO ?? new Date().toISOString(),
      pricePer: raw.pricePer ?? 5,
      tickets: raw.tickets ?? [makeEmptySelection()],
      participants: raw.participants ?? [],
      contributions: raw.contributions ?? [],
      shareMode: raw.shareMode ?? "equal",
      manualOverrides: raw.manualOverrides ?? {},
      createdAt: exists ? now : (raw.createdAt ?? now),
      updatedAt: now,
    };
    // Trust locally and overwrite or insert
    savePool(pool);
    return pool;
  } catch {
    return null;
  }
}

// Helpers for participants & shares
export function addParticipant(pool: Pool, name = "Участник"): Pool {
  const p: Participant = {
    id: typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : Math.random().toString(36).slice(2, 10),
    name,
    role: pool.participants.length === 0 ? "holder" : "member",
  };
  const updated: Pool = { ...pool, participants: [...pool.participants, p] };
  savePool(updated);
  return updated;
}

export function removeParticipant(pool: Pool, participantId: string): Pool {
  const participants = pool.participants.filter((x) => x.id !== participantId);
  const contributions = pool.contributions.filter((c) => c.participantId !== participantId);
  const manualOverrides = { ...(pool.manualOverrides ?? {}) };
  delete manualOverrides[participantId];
  const updated: Pool = { ...pool, participants, contributions, manualOverrides };
  savePool(updated);
  return updated;
}

export function setContributionTotal(pool: Pool, participantId: string, amount: number): Pool {
  const others = pool.contributions.filter((c) => c.participantId !== participantId);
  const now = new Date().toISOString();
  const entry: Contribution = {
    id: typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : Math.random().toString(36).slice(2, 10),
    participantId,
    amount: Math.max(0, Number.isFinite(amount) ? amount : 0),
    createdAt: now,
  };
  const updated: Pool = { ...pool, contributions: [...others, entry] };
  savePool(updated);
  return updated;
}

export function getContributionTotal(pool: Pool, participantId: string): number {
  return pool.contributions.filter((c) => c.participantId === participantId).reduce((s, c) => s + (c.amount || 0), 0);
}

export function setShareMode(pool: Pool, mode: ShareMode): Pool {
  const updated: Pool = { ...pool, shareMode: mode };
  savePool(updated);
  return updated;
}

export function setManualPercent(pool: Pool, participantId: string, percent: number): Pool {
  const manual = { ...(pool.manualOverrides ?? {}) };
  manual[participantId] = Math.max(0, percent);
  const updated: Pool = { ...pool, manualOverrides: manual };
  savePool(updated);
  return updated;
}

export type ComputedShare = { participantId: string; percent: number; amount: number };

export function computeShares(pool: Pool): { shares: ComputedShare[]; percentSum: number } {
  const participants = pool.participants;
  const bank = (pool.tickets?.length || 0) * (pool.pricePer || 0);
  const n = participants.length;
  if (n === 0) return { shares: [], percentSum: 0 };

  let percents: Record<string, number> = {};

  if (pool.shareMode === "equal") {
    const base = Math.floor((10000 / n)) / 100; // keep 2 decimals sum fix later
    let sum = base * (n - 1);
    participants.forEach((p, idx) => {
      if (idx < n - 1) percents[p.id] = base; else percents[p.id] = Math.max(0, 100 - sum);
    });
  } else if (pool.shareMode === "byContrib") {
    const totals = participants.map((p) => ({ id: p.id, amount: getContributionTotal(pool, p.id) }));
    const total = totals.reduce((s, t) => s + t.amount, 0);
    if (total <= 0) {
      // fallback to equal to avoid NaN
      const eq = computeShares({ ...pool, shareMode: "equal" }).shares;
      percents = Object.fromEntries(eq.map((s) => [s.participantId, s.percent]));
    } else {
      // compute proportional, keep 2 decimals, last gets remainder
      let acc = 0;
      totals.forEach((t, idx) => {
        if (idx < totals.length - 1) {
          const p = Math.floor((t.amount / total) * 10000) / 100; // 2dp
          percents[t.id] = p;
          acc += p;
        } else {
          percents[t.id] = Math.max(0, 100 - acc);
        }
      });
    }
  } else {
    // manual
    const manual = pool.manualOverrides ?? {};
    participants.forEach((p) => { percents[p.id] = Math.max(0, manual[p.id] ?? 0); });
  }

  const shares: ComputedShare[] = participants.map((p) => ({ participantId: p.id, percent: round2(percents[p.id] || 0), amount: round2((percents[p.id] || 0) * bank / 100) }));
  const percentSum = round2(shares.reduce((s, x) => s + x.percent, 0));
  return { shares, percentSum };
}

function round2(x: number) { return Math.round((x + Number.EPSILON) * 100) / 100; }
