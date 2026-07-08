import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { registerMutationHandler } from "@/application/offline/mutation-handler-registry";
import { resetRateLimiter, SYNC_RATE_LIMIT } from "@/infrastructure/shared/rate-limiter";
import { generateClientId } from "@/infrastructure/offline/id-generator";
import type { MutationHandler } from "@/application/offline/mutation-handler";

const context = {
  tenantId: "tenant-rate-limit-test",
  userId: "user-rate-limit-test",
  role: "PATRON" as const,
};

// requireTenantContext() dépend normalement de next/headers + better-auth
// (contexte de requête réel, absent hors d'un vrai cycle Next.js) — mocké
// ici pour isoler ce qu'on veut vraiment vérifier : que checkRateLimit est
// réellement appelé par actions.ts/route.ts, pas seulement testable en
// isolation (rate-limiter.test.ts couvre déjà la logique pure).
vi.mock("@/infrastructure/auth/session", () => ({
  requireTenantContext: vi.fn().mockResolvedValue(context),
  getTenantContext: vi.fn().mockResolvedValue(context),
}));

const entity = "fake-rate-limit-entity";

function fakeMutationInput() {
  return {
    id: generateClientId(),
    entity,
    action: "create" as const,
    payload: { name: "A" },
    clientGeneratedId: generateClientId(),
    createdAt: new Date().toISOString(),
    createdById: context.userId,
  };
}

describe("Rate limiting réellement branché sur les points d'entrée de sync", () => {
  const handler: MutationHandler = {
    create: vi.fn().mockResolvedValue({ updatedAt: new Date().toISOString() }),
    update: vi.fn(),
    delete: vi.fn(),
  };

  beforeEach(() => {
    resetRateLimiter();
    registerMutationHandler(entity, handler);
  });

  afterEach(() => {
    resetRateLimiter();
  });

  it("syncMutationAction (Server Action) refuse au-delà de la limite configurée", async () => {
    const { syncMutationAction } = await import("@/presentation/offline/actions");

    for (let i = 0; i < SYNC_RATE_LIMIT.limit; i++) {
      const result = await syncMutationAction(fakeMutationInput());
      expect(result.ok).toBe(true);
    }

    const limited = await syncMutationAction(fakeMutationInput());
    expect(limited).toEqual({ ok: false, reason: "rate_limited" });
  });

  it("POST /api/sync (Route Handler) refuse avec 429 au-delà de la même limite", async () => {
    const { POST } = await import("@/app/api/sync/route");
    const request = () =>
      new Request("http://localhost/api/sync", {
        method: "POST",
        body: JSON.stringify({ kind: "push", mutation: fakeMutationInput() }),
      });

    for (let i = 0; i < SYNC_RATE_LIMIT.limit; i++) {
      const response = await POST(request());
      expect(response.status).toBe(200);
    }

    const limited = await POST(request());
    expect(limited.status).toBe(429);
  });

  it("les deux transports partagent le même compteur (clé tenant+utilisateur commune)", async () => {
    const { syncMutationAction } = await import("@/presentation/offline/actions");
    const { POST } = await import("@/app/api/sync/route");
    const request = () =>
      new Request("http://localhost/api/sync", {
        method: "POST",
        body: JSON.stringify({ kind: "push", mutation: fakeMutationInput() }),
      });

    const half = Math.floor(SYNC_RATE_LIMIT.limit / 2);
    for (let i = 0; i < half; i++) {
      expect((await syncMutationAction(fakeMutationInput())).ok).toBe(true);
    }
    for (let i = 0; i < SYNC_RATE_LIMIT.limit - half; i++) {
      expect((await POST(request())).status).toBe(200);
    }

    const limitedViaAction = await syncMutationAction(fakeMutationInput());
    expect(limitedViaAction).toEqual({ ok: false, reason: "rate_limited" });
  });
});
