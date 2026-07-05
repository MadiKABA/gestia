import { test, expect } from "@playwright/test";

test("un visiteur non authentifié est redirigé vers /login", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/login$/);
});
