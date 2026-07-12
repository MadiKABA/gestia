import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { VendeursPanel } from "@/presentation/auth/components/vendeurs-panel";
import { authLabels } from "@/presentation/shared/labels";

const inviteVendeurActionMock = vi.fn();
const refreshMock = vi.fn();

/**
 * `inviteVendeurAction` mocké : ce test vérifie le câblage propre à ce
 * composant (affichage du lien de première connexion, copie presse-papier),
 * pas la logique métier de l'invitation (déjà couverte par
 * auth.use-cases.test.ts) — même choix que transaction-create-form.test.tsx.
 */
vi.mock("@/presentation/auth/actions", () => ({
  inviteVendeurAction: (...args: unknown[]) => inviteVendeurActionMock(...args),
  deactivateVendeurAction: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: refreshMock }),
}));

/** InviteVendeurModal passe par ResponsivePanel (Dialog/Sheet selon la
 * largeur d'écran) — jsdom n'implémente pas matchMedia, même stub que
 * payment-modal.test.tsx (peu importe desktop/mobile ici, le contenu rendu
 * est identique dans les deux cas). */
function stubMatchMedia(matches: boolean) {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    configurable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  });
}

const expectedLink = "http://localhost:3000/premiere-connexion?phone=%2B221771234567";

async function invite() {
  render(<VendeursPanel initialVendeurs={[]} />);
  await userEvent.click(screen.getByRole("button", { name: authLabels.inviteVendeurButtonLabel }));
  await userEvent.type(screen.getByLabelText("Nom du vendeur"), "Vendeur Test");
  await userEvent.type(screen.getByLabelText("Numéro de téléphone"), "771234567");
  await userEvent.click(screen.getByRole("button", { name: "Inviter" }));
  await screen.findByText(authLabels.vendeurInvitedTitle);
}

beforeEach(() => {
  inviteVendeurActionMock.mockReset().mockResolvedValue(undefined);
  refreshMock.mockReset();
  stubMatchMedia(false);
});

describe("VendeursPanel", () => {
  it("affiche le lien de première connexion après une invitation réussie", async () => {
    await invite();

    expect(screen.getByText(expectedLink)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: authLabels.copyLinkButton })).toBeInTheDocument();
  });

  it("affiche 'Lien copié !' quand la copie presse-papier réussit", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    await invite();

    await userEvent.click(screen.getByRole("button", { name: authLabels.copyLinkButton }));

    expect(
      await screen.findByRole("button", { name: authLabels.linkCopiedButton }),
    ).toBeInTheDocument();
    expect(writeText).toHaveBeenCalledWith(expectedLink);
  });

  it("affiche un message d'erreur quand la copie presse-papier échoue", async () => {
    const writeText = vi.fn().mockRejectedValue(new Error("Permission clipboard refusée"));
    Object.assign(navigator, { clipboard: { writeText } });
    await invite();

    await userEvent.click(screen.getByRole("button", { name: authLabels.copyLinkButton }));

    expect(await screen.findByText(authLabels.copyLinkFailedMessage)).toBeInTheDocument();
    // Le bouton reste à son libellé initial : l'échec ne doit jamais laisser
    // croire à tort que le lien a été copié.
    expect(screen.getByRole("button", { name: authLabels.copyLinkButton })).toBeInTheDocument();
  });
});
