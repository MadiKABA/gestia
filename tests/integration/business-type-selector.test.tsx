import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BusinessTypeSelector } from "@/presentation/shared/components/business-type-selector";
import { BUSINESS_TYPE_CODES, BUSINESS_TYPE_CONFIG } from "@/domain/tenant/business-type";
import type { BusinessTypeCode } from "@/domain/tenant/business-type";

function Harness() {
  const [value, setValue] = useState<BusinessTypeCode>("ALIMENTATION_GENERALE");
  return <BusinessTypeSelector value={value} onChange={setValue} />;
}

describe("BusinessTypeSelector", () => {
  it("affiche une carte pour chaque type de commerce de la liste fermée", () => {
    render(<Harness />);

    for (const code of BUSINESS_TYPE_CODES) {
      expect(
        screen.getByRole("button", { name: BUSINESS_TYPE_CONFIG[code].label }),
      ).toBeInTheDocument();
    }
  });

  it("marque uniquement la carte sélectionnée (aria-pressed)", () => {
    render(<Harness />);

    expect(screen.getByRole("button", { name: "Alimentation générale" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: "Boucherie" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  it("sélectionne une autre carte au clic (fonctionne identiquement carrousel/grille)", async () => {
    render(<Harness />);

    await userEvent.click(screen.getByRole("button", { name: "Boucherie" }));

    expect(screen.getByRole("button", { name: "Boucherie" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: "Alimentation générale" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  it("n'appelle pas onChange quand désactivé", async () => {
    const onChange = vi.fn();
    render(<BusinessTypeSelector value="ALIMENTATION_GENERALE" onChange={onChange} disabled />);

    await userEvent.click(screen.getByRole("button", { name: "Boucherie" }));

    expect(onChange).not.toHaveBeenCalled();
  });

  it("carrousel tactile sous lg (scroll-snap horizontal) puis grille à partir de lg", () => {
    const { container } = render(<Harness />);
    const group = container.querySelector('[role="group"]');

    // Mobile/tablette (< lg) : une seule ligne défilable avec alignement net.
    expect(group).toHaveClass("flex", "overflow-x-auto", "snap-x", "snap-mandatory");
    // Desktop (>= lg) : bascule en grille, plus de scroll horizontal.
    expect(group).toHaveClass("lg:grid", "lg:overflow-visible", "lg:snap-none");
  });

  it("le groupe est identifié pour les lecteurs d'écran", () => {
    render(<Harness />);
    expect(screen.getByRole("group", { name: "Type de commerce" })).toBeInTheDocument();
  });
});
