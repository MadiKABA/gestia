import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Button } from "@/components/ui/button";

describe("Button (presentation)", () => {
  it("déclenche onClick quand on clique dessus", async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Valider</Button>);

    await userEvent.click(screen.getByRole("button", { name: "Valider" }));

    expect(onClick).toHaveBeenCalledOnce();
  });

  it("est désactivé quand disabled est passé", () => {
    render(<Button disabled>Valider</Button>);
    expect(screen.getByRole("button", { name: "Valider" })).toBeDisabled();
  });
});
