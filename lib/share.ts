"use client";

import type { Pool } from "./pool";
import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from "lz-string";

export async function digestPoolForAgreement(pool: Pool): Promise<string> {
  const input = {
    version: 1,
    id: pool.id,
    name: pool.name,
    drawDateISO: pool.drawDateISO,
    pricePer: pool.pricePer,
    tickets: pool.tickets,
    participants: pool.participants.map((p) => ({ id: p.id, name: p.name, email: p.email, role: p.role })),
    shareMode: pool.shareMode,
    manualOverrides: pool.manualOverrides ?? {},
    createdAt: pool.createdAt,
    updatedAt: pool.updatedAt,
  };
  const text = JSON.stringify(input);
  const enc = new TextEncoder();
  const buf = enc.encode(text);
  const hash = await crypto.subtle.digest("SHA-256", buf);
  const arr = Array.from(new Uint8Array(hash));
  return arr.map((b) => b.toString(16).padStart(2, "0")).join("").toUpperCase();
}

export async function buildSmartLink(pool: Pool, origin: string): Promise<string> {
  const digest = await digestPoolForAgreement(pool);
  const payload = {
    type: "powerball.ru/pool-link",
    version: 1,
    exportedAt: new Date().toISOString(),
    digest,
    pool,
  };
  const json = JSON.stringify(payload);
  const packed = compressToEncodedURIComponent(json);
  const base = origin?.replace(/\/$/, "") || "";
  return `${base}/pool/import#d=${packed}`;
}

export function unpackSmartLinkData(fragment: string): { ok: boolean; error?: string; data?: any } {
  const m = fragment.match(/[#&]d=([^&]+)/);
  if (!m) return { ok: false, error: "no_data" };
  try {
    const decoded = decompressFromEncodedURIComponent(m[1]);
    if (!decoded) return { ok: false, error: "decode_failed" };
    const data = JSON.parse(decoded);
    if (!data || data.type !== "powerball.ru/pool-link" || !data.pool) return { ok: false, error: "invalid_format" };
    return { ok: true, data };
  } catch {
    return { ok: false, error: "parse_failed" };
  }
}

