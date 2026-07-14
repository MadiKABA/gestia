import { describe, expect, it } from "vitest";
import { resolveErrorMessage } from "@/presentation/shared/error-messages";
import { commonLabels } from "@/presentation/shared/labels";
import {
  DependencyNotFoundError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from "@/domain/shared/errors";

describe("resolveErrorMessage", () => {
  it("laisse passer le message d'une ValidationError, déjà un texte clair curaté par le domaine", () => {
    expect(resolveErrorMessage(new ValidationError("Le montant doit être supérieur à zéro"))).toBe(
      "Le montant doit être supérieur à zéro",
    );
  });

  it("traduit une ForbiddenError en message fixe", () => {
    expect(resolveErrorMessage(new ForbiddenError())).toBe(commonLabels.forbiddenErrorMessage);
  });

  it("traduit une DependencyNotFoundError en message fixe", () => {
    expect(resolveErrorMessage(new DependencyNotFoundError("Transaction", "abc-123"))).toBe(
      commonLabels.dependencyNotFoundErrorMessage,
    );
  });

  it("rejette le message brut d'une NotFoundError générique (expose un id technique) au profit du repli générique", () => {
    expect(resolveErrorMessage(new NotFoundError("Party", "abc-123"))).toBe(
      commonLabels.genericErrorToastMessage,
    );
  });

  it("rejette le message brut d'une Error non reconnue au profit du repli générique", () => {
    expect(resolveErrorMessage(new Error("TypeError: fetch failed"))).toBe(
      commonLabels.genericErrorToastMessage,
    );
  });

  it("retourne le message générique si l'erreur n'est même pas une instance Error", () => {
    expect(resolveErrorMessage("chaîne brute")).toBe(commonLabels.genericErrorToastMessage);
    expect(resolveErrorMessage(undefined)).toBe(commonLabels.genericErrorToastMessage);
  });
});
