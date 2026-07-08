import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { syncMutation } from "@/application/offline/sync-mutation.use-case";
import { registerMutationHandler } from "@/application/offline/mutation-handler-registry";
import { registerMutationSchema } from "@/application/offline/mutation-schema-registry";
import type { MutationHandler, QueuedMutation } from "@/application/offline/mutation-handler";
import type { AuditLogger } from "@/application/shared/audit-logger";
import { ValidationError } from "@/domain/shared/errors";
import { generateClientId } from "@/infrastructure/offline/id-generator";

const context = { tenantId: "tenant-1", userId: "user-1", role: "PATRON" as const };

function fakeMutation(overrides: Partial<QueuedMutation> = {}): QueuedMutation {
  return {
    id: generateClientId(),
    tenantId: context.tenantId,
    entity: "fake-entity",
    action: "create",
    payload: { name: "A" },
    clientGeneratedId: generateClientId(),
    createdAt: new Date().toISOString(),
    createdById: context.userId,
    ...overrides,
  };
}

describe("syncMutation", () => {
  it("rejette une entity sans gestionnaire enregistré", async () => {
    const auditLogger: AuditLogger = { log: vi.fn() };
    await expect(
      syncMutation(context, { auditLogger }, fakeMutation({ entity: "entite-inconnue" })),
    ).rejects.toThrow(ValidationError);
  });

  it("dispatch vers le gestionnaire enregistré et n'écrit aucun AuditLog sans conflit", async () => {
    const entity = `fake-${generateClientId()}`;
    const handler: MutationHandler = {
      create: vi.fn().mockResolvedValue({ updatedAt: "2026-01-01T00:00:00.000Z" }),
      update: vi.fn(),
      delete: vi.fn(),
    };
    registerMutationHandler(entity, handler);
    const auditLogger: AuditLogger = { log: vi.fn() };

    const result = await syncMutation(
      context,
      { auditLogger },
      fakeMutation({ entity, action: "create" }),
    );

    expect(handler.create).toHaveBeenCalledOnce();
    expect(result).toEqual({ updatedAt: "2026-01-01T00:00:00.000Z", conflict: false });
    expect(auditLogger.log).not.toHaveBeenCalled();
  });

  it("update sans clientKnownUpdatedAt est rejeté avant même d'appeler le gestionnaire", async () => {
    const entity = `fake-${generateClientId()}`;
    const handler: MutationHandler = {
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    };
    registerMutationHandler(entity, handler);
    const auditLogger: AuditLogger = { log: vi.fn() };

    await expect(
      syncMutation(
        context,
        { auditLogger },
        fakeMutation({ entity, action: "update", clientKnownUpdatedAt: undefined }),
      ),
    ).rejects.toThrow(ValidationError);
    expect(handler.update).not.toHaveBeenCalled();
  });

  it("écrit une seule entrée AuditLog quand le gestionnaire signale un conflit dernier-écrit-gagne", async () => {
    const entity = `fake-${generateClientId()}`;
    const handler: MutationHandler = {
      create: vi.fn(),
      update: vi.fn().mockResolvedValue({
        updatedAt: "2026-01-03T00:00:00.000Z",
        conflict: {
          serverValueBeforeOverwrite: { name: "Valeur écrasée" },
          serverUpdatedAtBeforeOverwrite: "2026-01-02T00:00:00.000Z",
        },
      }),
      delete: vi.fn(),
    };
    registerMutationHandler(entity, handler);
    const auditLogger: AuditLogger = { log: vi.fn() };
    const clientGeneratedId = generateClientId();

    const result = await syncMutation(
      context,
      { auditLogger },
      fakeMutation({
        entity,
        action: "update",
        payload: { name: "Nouvelle valeur" },
        clientGeneratedId,
        clientKnownUpdatedAt: "2026-01-01T00:00:00.000Z",
      }),
    );

    expect(result.conflict).toBe(true);
    expect(auditLogger.log).toHaveBeenCalledOnce();
    expect(auditLogger.log).toHaveBeenCalledWith(context, {
      action: `${entity}.sync_conflict`,
      entity,
      entityId: clientGeneratedId,
      oldData: { name: "Valeur écrasée" },
      newData: { name: "Nouvelle valeur" },
    });
  });

  it("rejette un payload qui échoue le schéma enregistré pour l'entity, avant tout appel au gestionnaire", async () => {
    const entity = `fake-${generateClientId()}`;
    const handler: MutationHandler = {
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    };
    registerMutationHandler(entity, handler);
    registerMutationSchema(entity, z.object({ name: z.string().min(1) }));
    const auditLogger: AuditLogger = { log: vi.fn() };

    await expect(
      syncMutation(
        context,
        { auditLogger },
        fakeMutation({ entity, action: "create", payload: { name: "" } }),
      ),
    ).rejects.toThrow(ValidationError);
    expect(handler.create).not.toHaveBeenCalled();
  });

  it("une entity sans schéma enregistré n'est pas bloquée (validation optionnelle)", async () => {
    const entity = `fake-${generateClientId()}`;
    const handler: MutationHandler = {
      create: vi.fn().mockResolvedValue({ updatedAt: "2026-01-01T00:00:00.000Z" }),
      update: vi.fn(),
      delete: vi.fn(),
    };
    registerMutationHandler(entity, handler);
    const auditLogger: AuditLogger = { log: vi.fn() };

    await syncMutation(
      context,
      { auditLogger },
      fakeMutation({ entity, action: "create", payload: { anything: "goes" } }),
    );

    expect(handler.create).toHaveBeenCalledWith(context, expect.any(String), {
      anything: "goes",
    });
  });
});
