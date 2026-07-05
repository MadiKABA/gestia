import { test, expect } from "@playwright/test";

test("la page d'accueil affiche le nom Gestia", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Gestia" })).toBeVisible();
});
