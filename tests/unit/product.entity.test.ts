import { describe, expect, it } from "vitest";
import { validateProductInput } from "@/domain/product/product.entity";
import { ValidationError } from "@/domain/shared/errors";

describe("validateProductInput", () => {
  it("accepte un produit sans nom d'unité ni suivi de stock", () => {
    expect(() =>
      validateProductInput({ name: "Sac de riz", type: "PRODUIT", sellingPrice: 15000 }),
    ).not.toThrow();
  });

  it("accepte un produit avec unité, sans suivi de stock", () => {
    expect(() =>
      validateProductInput({
        name: "Sac de riz",
        type: "PRODUIT",
        sellingPrice: 15000,
        unit: "SAC",
      }),
    ).not.toThrow();
  });

  it("accepte un produit avec suivi de stock et quantité", () => {
    expect(() =>
      validateProductInput({
        name: "Sac de riz",
        type: "PRODUIT",
        sellingPrice: 15000,
        unit: "SAC",
        trackStock: true,
        stockQuantity: 40,
      }),
    ).not.toThrow();
  });

  it("rejette un produit avec trackStock activé mais sans quantité", () => {
    expect(() =>
      validateProductInput({
        name: "Sac de riz",
        type: "PRODUIT",
        sellingPrice: 15000,
        trackStock: true,
      }),
    ).toThrow(ValidationError);
  });

  it("rejette un produit avec une quantité mais trackStock non activé", () => {
    expect(() =>
      validateProductInput({
        name: "Sac de riz",
        type: "PRODUIT",
        sellingPrice: 15000,
        stockQuantity: 10,
      }),
    ).toThrow(ValidationError);
  });

  it("accepte un service sans unité, quantité ni suivi de stock", () => {
    expect(() =>
      validateProductInput({ name: "Coupe de cheveux", type: "SERVICE", sellingPrice: 2000 }),
    ).not.toThrow();
  });

  it("rejette un service avec une unité renseignée", () => {
    expect(() =>
      validateProductInput({
        name: "Coupe de cheveux",
        type: "SERVICE",
        sellingPrice: 2000,
        unit: "PIECE",
      }),
    ).toThrow(ValidationError);
  });

  it("rejette un service avec une quantité en stock renseignée", () => {
    expect(() =>
      validateProductInput({
        name: "Coupe de cheveux",
        type: "SERVICE",
        sellingPrice: 2000,
        stockQuantity: 5,
      }),
    ).toThrow(ValidationError);
  });

  it("rejette un service avec le suivi de stock activé", () => {
    expect(() =>
      validateProductInput({
        name: "Coupe de cheveux",
        type: "SERVICE",
        sellingPrice: 2000,
        trackStock: true,
      }),
    ).toThrow(ValidationError);
  });

  it("rejette un produit sans nom", () => {
    expect(() => validateProductInput({ name: "  ", type: "PRODUIT", sellingPrice: 1000 })).toThrow(
      ValidationError,
    );
  });

  it("rejette un prix de vente négatif", () => {
    expect(() =>
      validateProductInput({ name: "Sac de riz", type: "PRODUIT", sellingPrice: -100 }),
    ).toThrow(ValidationError);
  });

  it("accepte un prix de vente à zéro (ex: produit offert)", () => {
    expect(() =>
      validateProductInput({ name: "Échantillon", type: "PRODUIT", sellingPrice: 0 }),
    ).not.toThrow();
  });

  it("accepte un produit sans prix d'achat renseigné", () => {
    expect(() =>
      validateProductInput({ name: "Sac de riz", type: "PRODUIT", sellingPrice: 15000 }),
    ).not.toThrow();
  });

  it("accepte un prix d'achat positif", () => {
    expect(() =>
      validateProductInput({
        name: "Sac de riz",
        type: "PRODUIT",
        purchasePrice: 12000,
        sellingPrice: 15000,
      }),
    ).not.toThrow();
  });

  it("rejette un prix d'achat négatif", () => {
    expect(() =>
      validateProductInput({
        name: "Sac de riz",
        type: "PRODUIT",
        purchasePrice: -1,
        sellingPrice: 15000,
      }),
    ).toThrow(ValidationError);
  });
});
