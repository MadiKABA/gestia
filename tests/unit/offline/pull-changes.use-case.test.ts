import { describe, expect, it, vi } from "vitest";
import { pullChanges } from "@/application/offline/pull-changes.use-case";
import { registerPullHandler } from "@/application/offline/pull-handler-registry";
import type { PullHandler } from "@/application/offline/pull-handler";
import { ValidationError } from "@/domain/shared/errors";
import { generateClientId } from "@/infrastructure/offline/id-generator";

const context = { tenantId: "tenant-1", userId: "user-1", role: "PATRON" as const };

describe("pullChanges", () => {
  it("rejette une entity sans gestionnaire enregistré", async () => {
    await expect(
      pullChanges(context, "entite-inconnue", new Date("2026-01-01T00:00:00.000Z")),
    ).rejects.toThrow(ValidationError);
  });

  it("dispatch vers le gestionnaire enregistré avec since/pageCursor et renvoie un serverTimestamp", async () => {
    const entity = `fake-${generateClientId()}`;
    const handler: PullHandler = {
      findChangedSince: vi.fn().mockResolvedValue({
        records: [{ id: "a", updatedAt: "2026-01-02T00:00:00.000Z", deletedAt: null, data: {} }],
        nextPageCursor: undefined,
      }),
    };
    registerPullHandler(entity, handler);
    const since = new Date("2026-01-01T00:00:00.000Z");

    const result = await pullChanges(context, entity, since, "page-1");

    expect(handler.findChangedSince).toHaveBeenCalledOnce();
    const call = vi.mocked(handler.findChangedSince).mock.calls[0];
    expect(call[0]).toBe(context);
    expect(call[1]).toBe(since);
    expect(call[2]).toBeInstanceOf(Date);
    expect(call[3]).toBe("page-1");

    expect(result.records).toHaveLength(1);
    expect(result.nextPageCursor).toBeUndefined();
    expect(new Date(result.serverTimestamp).getTime()).not.toBeNaN();
  });

  it("propage nextPageCursor pour la pagination", async () => {
    const entity = `fake-${generateClientId()}`;
    const handler: PullHandler = {
      findChangedSince: vi.fn().mockResolvedValue({ records: [], nextPageCursor: "page-2" }),
    };
    registerPullHandler(entity, handler);

    const result = await pullChanges(context, entity, new Date());

    expect(result.nextPageCursor).toBe("page-2");
  });
});
