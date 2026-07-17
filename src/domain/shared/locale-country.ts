/**
 * Résolution du pays probable du visiteur à partir du header HTTP
 * Accept-Language — seule source disponible sans dépendance externe ni appel
 * réseau supplémentaire sur l'infra actuelle (VPS Render, pas de header géo
 * automatique comme sur Vercel). Reste une pré-sélection modifiable par
 * l'utilisateur (`PhoneInput`), jamais une contrainte.
 */
const SUPPORTED_LOCALE_COUNTRIES = ["SN", "GN"] as const;
export type LocaleCountryCode = (typeof SUPPORTED_LOCALE_COUNTRIES)[number];

export const DEFAULT_LOCALE_COUNTRY: LocaleCountryCode = "SN";

const SUPPORTED_LOCALE_COUNTRY_SET: ReadonlySet<string> = new Set(SUPPORTED_LOCALE_COUNTRIES);

function isSupportedLocaleCountry(value: string): value is LocaleCountryCode {
  return SUPPORTED_LOCALE_COUNTRY_SET.has(value);
}

/**
 * Repli sur `DEFAULT_LOCALE_COUNTRY` dès que le sous-tag région est absent ou
 * hors de la liste fermée (SN/GN) — ex. "fr" seul (fréquent sur les téléphones
 * configurés en langue générique) ou "en-US". Ne lève jamais d'exception :
 * un header malformé ne doit jamais casser l'affichage du formulaire.
 */
export function resolveCountryFromAcceptLanguage(
  acceptLanguage: string | null | undefined,
): LocaleCountryCode {
  if (!acceptLanguage) return DEFAULT_LOCALE_COUNTRY;

  const tags = acceptLanguage.split(",").map((entry) => entry.split(";")[0]?.trim() ?? "");
  for (const tag of tags) {
    const region = tag.split("-")[1]?.toUpperCase();
    if (region && isSupportedLocaleCountry(region)) {
      return region;
    }
  }

  return DEFAULT_LOCALE_COUNTRY;
}
