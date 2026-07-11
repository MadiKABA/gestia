import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { registerMutationHandler } from "@/application/offline/mutation-handler-registry";
import { resetRateLimiter } from "@/infrastructure/shared/rate-limiter";
import { generateClientId } from "@/infrastructure/offline/id-generator";
import { ValidationError } from "@/domain/shared/errors";
import type { MutationHandler } from "@/application/offline/mutation-handler";

const context = {
  tenantId: "tenant-validation-error-transport-test",
  userId: "user-validation-error-transport-test",
  role: "PATRON" as const,
};

// Même mock que sync-rate-limit.test.ts : requireTenantContext() dépend
// normalement d'un vrai cycle Next.js, hors de portée ici.
vi.mock("@/infrastructure/auth/session", () => ({
  requireTenantContext: vi.fn().mockResolvedValue(context),
  getTenantContext: vi.fn().mockResolvedValue(context),
}));

const entity = "fake-validation-error-entity";
const errorMessage = "Le montant ne peut pas dépasser le solde restant";

function fakeMutationInput() {
  return {
    id: generateClientId(),
    entity,
    action: "create" as const,
    payload: { amount: 999999 },
    clientGeneratedId: generateClientId(),
    createdAt: new Date().toISOString(),
    createdById: context.userId,
  };
}

/**
 * Couvre le bug corrigé au commit "fix(offline-sync): nettoyage de la
 * mutation payment bloquée en erreur permanente" (sync-engine.ts) sur les
 * DEUX transports serveur qui exécutent syncMutation : la Server Action
 * (syncMutationAction, appelée en foreground) et le Route Handler
 * /api/sync (appelé uniquement par le service worker lors d'un événement
 * Background Sync, voir sw.ts). Une ValidationError levée par le use case
 * applicatif doit ressortir en `validation_error` sur les deux, jamais
 * comme une erreur générique que sync-engine.ts retenterait indéfiniment.
 */
describe("ValidationError traduite en reason 'validation_error' par les deux transports de sync", () => {
  const handler: MutationHandler = {
    create: vi.fn().mockRejectedValue(new ValidationError(errorMessage)),
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

  it("syncMutationAction (Server Action) renvoie { ok: false, reason: 'validation_error', message }", async () => {
    const { syncMutationAction } = await import("@/presentation/offline/actions");

    const result = await syncMutationAction(fakeMutationInput());

    expect(result).toEqual({ ok: false, reason: "validation_error", message: errorMessage });
  });

  it("POST /api/sync (Route Handler) renvoie un 422 avec la même raison, jamais un 500 générique", async () => {
    const { POST } = await import("@/app/api/sync/route");
    const request = new Request("http://localhost/api/sync", {
      method: "POST",
      body: JSON.stringify({ kind: "push", mutation: fakeMutationInput() }),
    });

    const response = await POST(request);

    expect(response.status).toBe(422);
    expect(await response.json()).toEqual({ error: errorMessage, reason: "validation_error" });
  });
});
