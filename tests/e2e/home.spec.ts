import { test, expect } from "@playwright/test";

test("un visiteur non authentifié voit l'écran d'accueil avec un bouton de connexion", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("button", { name: "Se connecter" })).toBeVisible();
});
