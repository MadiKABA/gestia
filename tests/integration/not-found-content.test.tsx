import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NotFoundContent } from "@/presentation/shared/components/not-found-content";
import { commonLabels, notFoundLabels } from "@/presentation/shared/labels";

const backMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ back: backMock }),
}));

beforeEach(() => {
  backMock.mockReset();
});

describe("NotFoundContent", () => {
  it("affiche le message dans le ton du glossaire, pas un 404 brut", () => {
    render(<NotFoundContent />);

    expect(screen.getByText(notFoundLabels.title)).toBeInTheDocument();
    expect(screen.queryByText(/404/)).not.toBeInTheDocument();
  });

  it("le bouton retour appelle router.back()", async () => {
    render(<NotFoundContent />);

    await userEvent.click(screen.getByRole("button", { name: commonLabels.back }));

    expect(backMock).toHaveBeenCalledTimes(1);
  });
});
