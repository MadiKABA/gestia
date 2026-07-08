import { describe, expect, it } from "vitest";
import { pullChangesInputSchema, queuedMutationInputSchema } from "@/presentation/offline/schemas";

describe("pullChangesInputSchema", () => {
  it("ignore silencieusement un tenantId injecté dans l'entrée — jamais transmis au use case", () => {
    const parsed = pullChangesInputSchema.parse({
      entity: "party",
      since: new Date().toISOString(),
      tenantId: "tenant-usurpe",
    });

    expect(parsed).not.toHaveProperty("tenantId");
    expect(Object.keys(parsed).sort()).toEqual(["entity", "since"]);
  });

  it("rejette une entity vide", () => {
    expect(() =>
      pullChangesInputSchema.parse({ entity: "", since: new Date().toISOString() }),
    ).toThrow();
  });

  it("rejette un since qui n'est pas une date ISO", () => {
    expect(() => pullChangesInputSchema.parse({ entity: "party", since: "hier" })).toThrow();
  });
});

describe("queuedMutationInputSchema", () => {
  it("ignore silencieusement un tenantId injecté dans l'entrée — jamais transmis au use case", () => {
    const parsed = queuedMutationInputSchema.parse({
      id: "mutation-1",
      entity: "party",
      action: "create",
      payload: { name: "A" },
      clientGeneratedId: "client-1",
      createdAt: new Date().toISOString(),
      createdById: "user-1",
      tenantId: "tenant-usurpe",
    });

    expect(parsed).not.toHaveProperty("tenantId");
  });

  it("rejette une action inconnue", () => {
    expect(() =>
      queuedMutationInputSchema.parse({
        id: "mutation-1",
        entity: "party",
        action: "delete-everything",
        payload: {},
        clientGeneratedId: "client-1",
        createdAt: new Date().toISOString(),
        createdById: "user-1",
      }),
    ).toThrow();
  });
});
