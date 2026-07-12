/**
 * Presets de couleur de marque (`TenantSettings.brandColor`) — seules valeurs
 * acceptées par `validateTenantSettingsInput` (domain/tenant-settings), jamais
 * de color picker RGB libre (cahier des charges §5, theming). Tous les
 * contrastes dépassent largement le seuil AA (4.5:1) vs blanc et vs
 * `--background` (#F7F8FA), et aucune teinte ne dérive vers les couleurs
 * sémantiques fixes (vert succès #1B7A5A, rouge alerte #C0392B, ambre warning).
 */
export const BRAND_PRESETS = [
  { value: "#0F2A4A", label: "Bleu marine" },
  { value: "#14456B", label: "Bleu ardoise" },
  { value: "#1D4E89", label: "Cobalt" },
  { value: "#3E3A72", label: "Indigo profond" },
  { value: "#5A3E6B", label: "Violet prune" },
  { value: "#37474F", label: "Graphite" },
  { value: "#6B4226", label: "Terracotta" },
  { value: "#2C4A52", label: "Bleu-pétrole ardoise" },
] as const;

export const BRAND_PRESET_VALUES: ReadonlySet<string> = new Set(
  BRAND_PRESETS.map((preset) => preset.value),
);
