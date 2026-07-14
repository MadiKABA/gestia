"use client";

import { getCountries, getCountryCallingCode, type CountryCode } from "libphonenumber-js/min";
import { Input } from "@/presentation/shared/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/presentation/shared/components/ui/select";
import { cn } from "@/lib/utils";

/** Codes ISO 3166-1 alpha-2 des pays africains desservis — Sénégal en tête
 * (marché principal). Les indicatifs et la validation viennent de
 * `libphonenumber-js` (donnée de référence maintenue), pas d'un tableau
 * codé à la main. */
const AFRICAN_ISO_CODES: CountryCode[] = [
  "SN",
  "DZ",
  "AO",
  "BJ",
  "BW",
  "BF",
  "BI",
  "CV",
  "CM",
  "CF",
  "TD",
  "KM",
  "CG",
  "CD",
  "CI",
  "DJ",
  "EG",
  "GQ",
  "ER",
  "SZ",
  "ET",
  "GA",
  "GM",
  "GH",
  "GN",
  "GW",
  "KE",
  "LS",
  "LR",
  "LY",
  "MG",
  "MW",
  "ML",
  "MR",
  "MU",
  "MA",
  "MZ",
  "NA",
  "NE",
  "NG",
  "RW",
  "ST",
  "SC",
  "SL",
  "SO",
  "ZA",
  "SS",
  "SD",
  "TZ",
  "TG",
  "TN",
  "UG",
  "ZM",
  "ZW",
];

const countryDisplayNames = new Intl.DisplayNames(["fr"], { type: "region" });
const supportedCountries = new Set(getCountries());

const AFRICAN_COUNTRIES = AFRICAN_ISO_CODES.filter((code) => supportedCountries.has(code)).map(
  (code) => ({
    code,
    name: countryDisplayNames.of(code) ?? code,
    dialCode: `+${getCountryCallingCode(code)}`,
  }),
);

const DEFAULT_COUNTRY = AFRICAN_COUNTRIES.find((c) => c.code === "SN") ?? AFRICAN_COUNTRIES[0];

const DIAL_CODES_BY_LENGTH = [...AFRICAN_COUNTRIES].sort(
  (a, b) => b.dialCode.length - a.dialCode.length,
);

function splitPhone(value: string) {
  const match = DIAL_CODES_BY_LENGTH.find((country) => value.startsWith(country.dialCode));
  const country = match ?? DEFAULT_COUNTRY;
  return {
    country,
    local: value.startsWith(country.dialCode) ? value.slice(country.dialCode.length) : value,
  };
}

/** Saisie de téléphone avec sélecteur d'indicatif limité aux pays africains
 * desservis — la valeur exposée au parent reste un numéro complet (+221...). */
export function PhoneInput({
  id,
  value,
  onValueChange,
  required,
  autoFocus,
  className,
}: {
  id?: string;
  value: string;
  onValueChange: (value: string) => void;
  required?: boolean;
  autoFocus?: boolean;
  className?: string;
}) {
  const { country, local } = splitPhone(value || DEFAULT_COUNTRY.dialCode);

  // Tant qu'aucun chiffre local n'est saisi, la valeur exposée au parent
  // reste "" (jamais un indicatif seul, ex. "+221") — sinon le simple fait
  // d'ouvrir/sélectionner le pays sans rien taper transforme un champ vide en
  // valeur "remplie", qui passe la règle "au moins un contact" côté domaine
  // tout en étant un numéro invalide (voir régression wa.me).
  function handleCountryChange(dialCode: string | null) {
    if (!dialCode) return;
    onValueChange(local ? `${dialCode}${local}` : "");
  }

  function handleLocalChange(nextLocal: string) {
    const digits = nextLocal.replace(/\D/g, "");
    onValueChange(digits ? `${country.dialCode}${digits}` : "");
  }

  return (
    <div className={cn("flex gap-2", className)}>
      <Select value={country.dialCode} onValueChange={handleCountryChange}>
        <SelectTrigger aria-label="Indicatif pays" className="h-10 w-24 shrink-0 gap-1 px-2">
          <SelectValue>
            {() => (
              <span className="flex items-center gap-1">
                <span>{isoToFlagEmoji(country.code)}</span>
                <span>{country.dialCode}</span>
              </span>
            )}
          </SelectValue>
        </SelectTrigger>
        <SelectContent className="min-w-72">
          {AFRICAN_COUNTRIES.map((c) => (
            <SelectItem key={c.code} value={c.dialCode}>
              <span>{isoToFlagEmoji(c.code)}</span>
              <span>{c.dialCode}</span>
              <span className="text-muted-foreground whitespace-normal">{c.name}</span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Input
        id={id}
        type="tel"
        inputMode="tel"
        placeholder="77 123 45 67"
        value={local}
        onValueChange={handleLocalChange}
        required={required}
        autoFocus={autoFocus}
        className="min-w-0 flex-1"
      />
    </div>
  );
}

/** Drapeau dérivé de l'ISO 3166-1 alpha-2 (formule Unicode standard des
 * symboles indicateurs régionaux) — pas de dépendance ni de liste d'emojis
 * codée en dur. */
function isoToFlagEmoji(code: string): string {
  return String.fromCodePoint(
    ...[...code.toUpperCase()].map((char) => 0x1f1e6 + char.charCodeAt(0) - 65),
  );
}
