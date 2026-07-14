import { useState } from "react";
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PhoneInput } from "@/presentation/shared/components/phone-input";

/**
 * Régression wa.me : ouvrir/sélectionner le pays sans jamais taper de
 * chiffre local ne doit jamais produire un indicatif seul ("+221") — cette
 * valeur est non-vide (passe la règle "au moins un contact") mais invalide
 * (rejetée par validatePhoneFormat), et si elle finissait quand même
 * en base (whatsappNumber d'une ligne historique), un lien wa.me construit
 * dessus ne pointe vers aucun contact réel.
 */
function Harness() {
  const [value, setValue] = useState("");
  return (
    <div>
      <PhoneInput id="test-phone" value={value} onValueChange={setValue} />
      <p data-testid="value">{value}</p>
    </div>
  );
}

describe("PhoneInput", () => {
  it("reste vide quand on sélectionne un pays sans jamais taper de chiffre", async () => {
    render(<Harness />);

    await userEvent.click(screen.getByLabelText("Indicatif pays"));
    const options = await screen.findAllByRole("option", { name: /Sénégal/ });
    await userEvent.click(options[options.length - 1]);

    expect(screen.getByTestId("value")).toHaveTextContent("");
  });

  it("émet un numéro complet une fois des chiffres locaux saisis", async () => {
    render(<Harness />);

    await userEvent.type(screen.getByPlaceholderText("77 123 45 67"), "771234567");

    expect(screen.getByTestId("value")).toHaveTextContent("+221771234567");
  });

  it("redevient vide si tous les chiffres locaux sont effacés après saisie", async () => {
    render(<Harness />);

    const input = screen.getByPlaceholderText("77 123 45 67");
    await userEvent.type(input, "771234567");
    await userEvent.clear(input);

    expect(screen.getByTestId("value")).toHaveTextContent("");
  });
});
