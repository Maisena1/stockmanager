import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  ensureAdminSession,
  validateAdminJti,
  touchAdminSession,
  clearAdminSession,
  getAdminSession,
} from "./sessions";

beforeEach(() => {
  process.env.ADMIN_SESSION_TTL_MIN = "5";
  clearAdminSession();
  vi.useRealTimers();
});

afterEach(() => {
  clearAdminSession();
  vi.useRealTimers();
  delete process.env.ADMIN_SESSION_TTL_MIN;
});

describe("ensureAdminSession", () => {
  it("creates a session with a unique jti on first login", () => {
    const first = ensureAdminSession(1);
    expect(first.ok).toBe(true);
    if (first.ok) expect(first.session.jti).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("blocks a second admin login while one is active", () => {
    expect(ensureAdminSession(1).ok).toBe(true);
    expect(ensureAdminSession(2).ok).toBe(false);
  });

  it("frees the slot after logout", () => {
    const first = ensureAdminSession(1);
    expect(first.ok).toBe(true);
    if (first.ok) clearAdminSession(first.session.jti);
    expect(ensureAdminSession(2).ok).toBe(true);
  });
});

describe("validateAdminJti", () => {
  it("accepts the current jti and rejects unknown ones", () => {
    const created = ensureAdminSession(1);
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    expect(validateAdminJti(created.session.jti)).toBe(true);
    expect(validateAdminJti("00000000-0000-0000-0000-000000000000")).toBe(false);
    expect(validateAdminJti(undefined)).toBe(false);
  });

  it("rejects after the inactivity TTL", () => {
    vi.useFakeTimers();
    const created = ensureAdminSession(1);
    expect(created.ok).toBe(true);
    vi.advanceTimersByTime(6 * 60 * 1000);
    expect(validateAdminJti(created.ok ? created.session.jti : undefined)).toBe(false);
    expect(ensureAdminSession(2).ok).toBe(true);
  });

  it("rejects after 8 hours even with heartbeat", () => {
    vi.useFakeTimers();
    const created = ensureAdminSession(1);
    expect(created.ok).toBe(true);
    vi.advanceTimersByTime(7 * 60 * 60 * 1000);
    touchAdminSession();
    vi.advanceTimersByTime(61 * 60 * 1000);
    expect(validateAdminJti(created.ok ? created.session.jti : undefined)).toBe(false);
  });

  it("heartbeat keeps the session alive past the TTL", () => {
    vi.useFakeTimers();
    const created = ensureAdminSession(1);
    expect(created.ok).toBe(true);
    vi.advanceTimersByTime(4 * 60 * 1000);
    touchAdminSession();
    vi.advanceTimersByTime(4 * 60 * 1000);
    expect(validateAdminJti(created.ok ? created.session.jti : undefined)).toBe(true);
    expect(getAdminSession()).not.toBeNull();
  });
});