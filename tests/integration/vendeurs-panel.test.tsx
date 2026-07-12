import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { VendeursPanel } from "@/presentation/auth/components/vendeurs-panel";
import { authLabels } from "@/presentation/shared/labels";

const inviteVendeurActionMock = vi.fn();
const deactivateVendeurActionMock = vi.fn();
const reactivateVendeurActionMock = vi.fn();
const updateVendeurActionMock = vi.fn();
const refreshMock = vi.fn();

/**
 * `inviteVendeurAction` mocké : ce test vérifie le câblage propre à ce
 * composant (affichage du lien de première connexion, copie presse-papier),
 * pas la logique métier de l'invitation (déjà couverte par
 * auth.use-cases.test.ts) — même choix que transaction-create-form.test.tsx.
 */
vi.mock("@/presentation/auth/actions", () => ({
  inviteVendeurAction: (...args: unknown[]) => inviteVendeurActionMock(...args),
  deactivateVendeurAction: (...args: unknown[]) => deactivateVendeurActionMock(...args),
  reactivateVendeurAction: (...args: unknown[]) => reactivateVendeurActionMock(...args),
  updateVendeurAction: (...args: unknown[]) => updateVendeurActionMock(...args),
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

const vendeurActif = {
  id: "vendeur-actif",
  name: "Awa Diop",
  phone: "+221771111111",
  active: true,
  createdAt: new Date("2026-01-10"),
  firstLoginAt: new Date("2026-01-11"),
};
const vendeurDesactive = {
  id: "vendeur-desactive",
  name: "Moussa Ba",
  phone: "+221772222222",
  active: false,
  createdAt: new Date("2026-01-12"),
  firstLoginAt: new Date("2026-01-13"),
};
const vendeurEnAttente = {
  id: "vendeur-en-attente",
  name: "Fatou Sarr",
  phone: "+221773333333",
  active: true,
  createdAt: new Date("2026-01-14"),
  firstLoginAt: null,
};

beforeEach(() => {
  inviteVendeurActionMock.mockReset().mockResolvedValue(undefined);
  deactivateVendeurActionMock.mockReset().mockResolvedValue(undefined);
  reactivateVendeurActionMock.mockReset().mockResolvedValue(undefined);
  updateVendeurActionMock.mockReset().mockResolvedValue(undefined);
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

  it("ouvre et ferme la modale d'invitation", async () => {
    // Dialog (desktop) plutôt que Sheet : le bouton de fermeture porte un
    // libellé français ("Fermer") cohérent avec le reste de la suite.
    stubMatchMedia(true);
    render(<VendeursPanel initialVendeurs={[]} />);

    expect(screen.queryByLabelText("Nom du vendeur")).not.toBeInTheDocument();

    await userEvent.click(
      screen.getByRole("button", { name: authLabels.inviteVendeurButtonLabel }),
    );
    expect(await screen.findByLabelText("Nom du vendeur")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Fermer" }));

    await vi.waitFor(() => {
      expect(screen.queryByLabelText("Nom du vendeur")).not.toBeInTheDocument();
    });
    expect(inviteVendeurActionMock).not.toHaveBeenCalled();
  });

  it("filtre la liste par recherche (nom/téléphone) et par statut", async () => {
    render(<VendeursPanel initialVendeurs={[vendeurActif, vendeurDesactive, vendeurEnAttente]} />);
    // Le tableau desktop/tablette et les cards mobile sont tous deux rendus
    // dans le DOM (le basculement se fait en CSS, invisible pour jsdom) —
    // les assertions ciblent donc le tableau pour éviter les doublons.
    const table = screen.getByRole("table");

    expect(within(table).getByText("Awa Diop")).toBeInTheDocument();
    expect(within(table).getByText("Moussa Ba")).toBeInTheDocument();
    expect(within(table).getByText("Fatou Sarr")).toBeInTheDocument();

    await userEvent.type(screen.getByPlaceholderText(authLabels.searchPlaceholder), "Awa");
    expect(within(table).getByText("Awa Diop")).toBeInTheDocument();
    expect(within(table).queryByText("Moussa Ba")).not.toBeInTheDocument();
    expect(within(table).queryByText("Fatou Sarr")).not.toBeInTheDocument();

    // Recherche par téléphone.
    await userEvent.clear(screen.getByPlaceholderText(authLabels.searchPlaceholder));
    await userEvent.type(screen.getByPlaceholderText(authLabels.searchPlaceholder), "772222222");
    expect(within(table).getByText("Moussa Ba")).toBeInTheDocument();
    expect(within(table).queryByText("Awa Diop")).not.toBeInTheDocument();

    await userEvent.clear(screen.getByPlaceholderText(authLabels.searchPlaceholder));

    await userEvent.click(screen.getByRole("combobox"));
    await userEvent.click(await screen.findByRole("option", { name: authLabels.statusPending }));

    expect(within(table).getByText("Fatou Sarr")).toBeInTheDocument();
    expect(within(table).queryByText("Awa Diop")).not.toBeInTheDocument();
    expect(within(table).queryByText("Moussa Ba")).not.toBeInTheDocument();
  });

  it("permet de copier le lien de première connexion à tout moment pour un vendeur en attente", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    render(<VendeursPanel initialVendeurs={[vendeurEnAttente]} />);

    // Disponible directement depuis la liste, sans passer par une invitation
    // dans cette même session.
    await userEvent.click(screen.getByRole("button", { name: authLabels.copyLinkRowActionLabel }));

    expect(writeText).toHaveBeenCalledWith(
      "http://localhost:3000/premiere-connexion?phone=%2B221773333333",
    );
  });

  it("modifie le nom d'un vendeur via la modale d'édition, sans jamais toucher au téléphone", async () => {
    render(<VendeursPanel initialVendeurs={[vendeurActif]} />);
    const table = screen.getByRole("table");

    await userEvent.click(
      within(table).getByRole("button", { name: authLabels.editVendeurButtonLabel }),
    );
    const nameInput = await screen.findByLabelText(authLabels.vendeurNameField);
    await userEvent.clear(nameInput);
    await userEvent.type(nameInput, "Awa Diop Renommée");
    await userEvent.click(screen.getByRole("button", { name: authLabels.saveVendeurButtonLabel }));

    await vi.waitFor(() => {
      expect(within(table).getByText("Awa Diop Renommée")).toBeInTheDocument();
    });
    expect(updateVendeurActionMock).toHaveBeenCalledWith({
      vendeurId: vendeurActif.id,
      name: "Awa Diop Renommée",
    });
    // Aucune trace d'un champ téléphone dans le payload envoyé au serveur.
    expect(updateVendeurActionMock.mock.calls[0][0]).not.toHaveProperty("phone");
  });
});
