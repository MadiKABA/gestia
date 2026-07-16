import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { WhatsappReceiptLink } from "@/presentation/payment/components/whatsapp-receipt-link";
import { paymentLabels } from "@/presentation/shared/labels";

const baseProps = {
  phone: "+221771234567",
  client: "Fatou Diop",
  amountPaid: 2000,
  method: "CASH" as const,
  remainingBalance: 4000,
  totalAmount: 6000,
  boutique: "Boutique Fatou",
  currency: "FCFA" as const,
  date: new Date("2026-07-12T10:00:00Z"),
  partialTemplate: null,
  finalTemplate: null,
};

describe("WhatsappReceiptLink", () => {
  it("ne rend rien si le statut est EN_COURS", () => {
    const { container } = render(<WhatsappReceiptLink {...baseProps} status="EN_COURS" />);
    expect(container).toBeEmptyDOMElement();
  });

  it("utilise le gabarit par défaut si aucun gabarit personnalisé n'est fourni (partiel), avec boutique/montant total/date", () => {
    render(<WhatsappReceiptLink {...baseProps} status="PARTIELLE" />);

    expect(screen.getByText(/il te reste maintenant 4 000 FCFA/)).toBeInTheDocument();
    expect(screen.getByText(/Boutique Fatou/)).toBeInTheDocument();
    expect(screen.getByText(/6 000 FCFA/)).toBeInTheDocument();
    expect(screen.getByText(/12 juillet 2026/)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: paymentLabels.sendReceiptButtonLabel }),
    ).toBeInTheDocument();
  });

  it("utilise le gabarit par défaut si aucun gabarit personnalisé n'est fourni (final), avec boutique/montant total/date", () => {
    render(<WhatsappReceiptLink {...baseProps} status="REGLEE" />);

    expect(screen.getByText(/Safi/)).toBeInTheDocument();
    expect(screen.getByText(/Boutique Fatou/)).toBeInTheDocument();
    expect(screen.getByText(/6 000 FCFA/)).toBeInTheDocument();
    expect(screen.getByText(/12 juillet 2026/)).toBeInTheDocument();
  });

  it("utilise le gabarit personnalisé du tenant quand il est fourni", () => {
    render(
      <WhatsappReceiptLink
        {...baseProps}
        status="PARTIELLE"
        partialTemplate="Merci {client}, il te reste {montantRestant} FCFA à régler."
      />,
    );

    expect(
      screen.getByText("Merci Fatou Diop, il te reste 4 000 FCFA à régler."),
    ).toBeInTheDocument();
  });

  it("construit un lien wa.me bien formé avec le message encodé", () => {
    render(<WhatsappReceiptLink {...baseProps} status="REGLEE" />);

    const link = screen.getByRole("button", { name: paymentLabels.sendReceiptButtonLabel });
    expect(link).toHaveAttribute(
      "href",
      expect.stringContaining("https://wa.me/221771234567?text="),
    );
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("affiche le mode de paiement dans le message (reçu partiel)", () => {
    render(<WhatsappReceiptLink {...baseProps} status="PARTIELLE" method="WAVE" />);

    expect(screen.getByText(/par Wave/)).toBeInTheDocument();
  });

  it("un tenant en GNF ne laisse plus aucune trace de FCFA dans le reçu généré", () => {
    render(<WhatsappReceiptLink {...baseProps} status="PARTIELLE" currency="GNF" />);

    expect(screen.getByText(/6 000 GNF/)).toBeInTheDocument();
    expect(screen.queryByText(/FCFA/)).not.toBeInTheDocument();
  });
});
