import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { landingLabels } from "@/presentation/shared/labels";

const getTenantContextMock = vi.fn();
const redirectMock = vi.fn((_url: string) => {
  throw new Error("REDIRECT");
});

vi.mock("@/infrastructure/auth/session", () => ({
  getTenantContext: () => getTenantContextMock(),
}));

vi.mock("next/navigation", () => ({
  redirect: (url: string) => redirectMock(url),
}));

beforeEach(() => {
  getTenantContextMock.mockReset();
  redirectMock.mockClear();
});

describe("Home (écran d'accueil)", () => {
  it("redirige vers /dashboard si une session valide existe", async () => {
    getTenantContextMock.mockResolvedValue({
      tenantId: "tenant-1",
      userId: "user-1",
      role: "PATRON",
    });
    const { default: Home } = await import("@/app/page");

    await expect(Home()).rejects.toThrow("REDIRECT");
    expect(redirectMock).toHaveBeenCalledWith("/dashboard");
  });

  it("affiche l'écran d'accueil avec le bouton \"Se connecter\" si aucune session", async () => {
    getTenantContextMock.mockResolvedValue(null);
    const { default: Home } = await import("@/app/page");

    const jsx = await Home();
    render(jsx);

    expect(redirectMock).not.toHaveBeenCalled();
    const loginButton = screen.getByRole("button", { name: landingLabels.loginButtonLabel });
    expect(loginButton).toHaveAttribute("href", "/login");
    const registerLink = screen.getByRole("link", { name: landingLabels.registerLinkLabel });
    expect(registerLink).toHaveAttribute("href", "/register");
  });
});
