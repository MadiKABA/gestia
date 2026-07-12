import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { RequestOtpForm } from "@/presentation/auth/components/request-otp-form";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

describe("RequestOtpForm", () => {
  it("préremplit le téléphone quand initialIdentifier est fourni (arrivée depuis un lien de première connexion expiré)", () => {
    render(
      <RequestOtpForm
        action={vi.fn()}
        nextPathBase="/reset-pin/confirm"
        submitLabel="Recevoir le code"
        initialIdentifier="+221771234567"
      />,
    );

    expect(screen.getByLabelText("Numéro de téléphone")).toHaveValue("771234567");
  });

  it("laisse le téléphone vide sans initialIdentifier", () => {
    render(
      <RequestOtpForm
        action={vi.fn()}
        nextPathBase="/reset-pin/confirm"
        submitLabel="Recevoir le code"
      />,
    );

    expect(screen.getByLabelText("Numéro de téléphone")).toHaveValue("");
  });
});
