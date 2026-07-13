import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const getSessionCookieMock = vi.fn();

vi.mock("better-auth/cookies", () => ({
  getSessionCookie: (request: NextRequest) => getSessionCookieMock(request),
}));

beforeEach(() => {
  getSessionCookieMock.mockReset();
});

function makeRequest(pathname: string) {
  return new NextRequest(new URL(pathname, "http://localhost:3000"));
}

describe("proxy", () => {
  it("laisse passer / sans session (landing publique)", async () => {
    const { proxy } = await import("@/proxy");
    getSessionCookieMock.mockReturnValue(null);

    const response = proxy(makeRequest("/"));

    expect(response.headers.get("location")).toBeNull();
  });

  it("redirige vers /login une route protégée sans session", async () => {
    const { proxy } = await import("@/proxy");
    getSessionCookieMock.mockReturnValue(null);

    const response = proxy(makeRequest("/dashboard"));

    expect(response.headers.get("location")).toBe("http://localhost:3000/login");
  });

  it("redirige une session valide sur /login vers /dashboard", async () => {
    const { proxy } = await import("@/proxy");
    getSessionCookieMock.mockReturnValue("session-token");

    const response = proxy(makeRequest("/login"));

    expect(response.headers.get("location")).toBe("http://localhost:3000/dashboard");
  });

  it("laisse passer / avec une session valide (la redirection vers /dashboard est gérée par la page elle-même)", async () => {
    const { proxy } = await import("@/proxy");
    getSessionCookieMock.mockReturnValue("session-token");

    const response = proxy(makeRequest("/"));

    expect(response.headers.get("location")).toBeNull();
  });
});
