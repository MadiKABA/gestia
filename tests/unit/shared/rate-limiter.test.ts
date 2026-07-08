import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { checkRateLimit, resetRateLimiter } from "@/infrastructure/shared/rate-limiter";

beforeEach(() => {
  resetRateLimiter();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("checkRateLimit", () => {
  it("autorise les appels tant que la limite n'est pas atteinte", () => {
    expect(checkRateLimit("tenant-1:user-1", { limit: 3, windowMs: 60_000 })).toBe(true);
    expect(checkRateLimit("tenant-1:user-1", { limit: 3, windowMs: 60_000 })).toBe(true);
    expect(checkRateLimit("tenant-1:user-1", { limit: 3, windowMs: 60_000 })).toBe(true);
  });

  it("refuse à partir du (limit + 1)-ième appel dans la fenêtre", () => {
    for (let i = 0; i < 3; i++) {
      checkRateLimit("tenant-1:user-1", { limit: 3, windowMs: 60_000 });
    }
    expect(checkRateLimit("tenant-1:user-1", { limit: 3, windowMs: 60_000 })).toBe(false);
  });

  it("isole les compteurs par clé", () => {
    for (let i = 0; i < 3; i++) {
      checkRateLimit("tenant-1:user-1", { limit: 3, windowMs: 60_000 });
    }
    expect(checkRateLimit("tenant-1:user-2", { limit: 3, windowMs: 60_000 })).toBe(true);
  });

  it("redevient autorisé une fois la fenêtre glissante écoulée", () => {
    vi.useFakeTimers();
    const config = { limit: 2, windowMs: 1_000 };
    expect(checkRateLimit("tenant-1:user-1", config)).toBe(true);
    expect(checkRateLimit("tenant-1:user-1", config)).toBe(true);
    expect(checkRateLimit("tenant-1:user-1", config)).toBe(false);

    vi.advanceTimersByTime(1_001);

    expect(checkRateLimit("tenant-1:user-1", config)).toBe(true);
  });
});
