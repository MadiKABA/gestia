import { describe, expect, it, vi, beforeEach } from "vitest";

const signInPinMock = vi.fn();
const redirectMock = vi.fn((_url: string) => {
  throw new Error("REDIRECT");
});

vi.mock("@/infrastructure/auth/better-auth", () => ({
  getAuth: () => ({ api: { signInPin: (...args: unknown[]) => signInPinMock(...args) } }),
}));

vi.mock("next/navigation", () => ({
  redirect: (url: string) => redirectMock(url),
}));

beforeEach(() => {
  signInPinMock.mockReset();
  redirectMock.mockClear();
});

describe("loginAction", () => {
  it("redirige vers /dashboard après une connexion réussie, jamais vers /", async () => {
    signInPinMock.mockResolvedValue(undefined);
    const { loginAction } = await import("@/presentation/auth/actions");

    await expect(
      loginAction({ channel: "PHONE", identifier: "+221770000001", pin: "1234" }),
    ).rejects.toThrow("REDIRECT");

    expect(redirectMock).toHaveBeenCalledWith("/dashboard");
    expect(redirectMock).not.toHaveBeenCalledWith("/");
  });
});
