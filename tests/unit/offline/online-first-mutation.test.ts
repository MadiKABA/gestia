import { describe, expect, it } from "vitest";
import { attemptOnlineMutation } from "@/infrastructure/offline/online-first-mutation";
import { generateClientId } from "@/infrastructure/offline/id-generator";
import type { QueuedMutation } from "@/application/offline/mutation-handler";

function fakeMutation(): QueuedMutation {
  return {
    id: generateClientId(),
    tenantId: generateClientId(),
    entity: "party",
    action: "create",
    payload: { name: "A" },
    clientGeneratedId: generateClientId(),
    createdAt: new Date().toISOString(),
    createdById: "user-1",
  };
}

describe("attemptOnlineMutation", () => {
  it("résout 'success' avec l'updatedAt serveur quand le transport réussit", async () => {
    const result = await attemptOnlineMutation(
      async () => ({ ok: true, data: { updatedAt: "2026-01-01T00:00:00.000Z", conflict: false } }),
      fakeMutation(),
    );

    expect(result).toEqual({ status: "success", updatedAt: "2026-01-01T00:00:00.000Z" });
  });

  it("résout 'validation_error' avec le message quand le transport renvoie cette raison", async () => {
    const result = await attemptOnlineMutation(
      async () => ({
        ok: false,
        reason: "validation_error",
        message: "Le montant ne peut pas dépasser le solde restant",
      }),
      fakeMutation(),
    );

    expect(result).toEqual({
      status: "validation_error",
      message: "Le montant ne peut pas dépasser le solde restant",
    });
  });

  it("résout 'transient_error' pour auth_required (repli offline, jamais une erreur de validation)", async () => {
    const result = await attemptOnlineMutation(
      async () => ({ ok: false, reason: "auth_required" }),
      fakeMutation(),
    );

    expect(result).toEqual({ status: "transient_error" });
  });

  it("résout 'transient_error' pour rate_limited", async () => {
    const result = await attemptOnlineMutation(
      async () => ({ ok: false, reason: "rate_limited" }),
      fakeMutation(),
    );

    expect(result).toEqual({ status: "transient_error" });
  });

  it("résout 'transient_error' quand le transport rejette (réseau, bug serveur) — jamais une exception qui remonte à l'appelant", async () => {
    const result = await attemptOnlineMutation(async () => {
      throw new Error("fetch failed");
    }, fakeMutation());

    expect(result).toEqual({ status: "transient_error" });
  });
});
