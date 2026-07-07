"use client";

import { REGEXP_ONLY_DIGITS } from "input-otp";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/presentation/shared/components/ui/input-otp";
import { PIN_LENGTH } from "@/domain/auth/pin-policy";

/** Saisie du PIN (4 chiffres) en cases séparées, même pattern que `OtpInput`
 * mais chiffres masqués case par case. `onComplete` reçoit la valeur complète
 * directement (pas le state du parent, qui n'a pas encore re-rendu au moment
 * où la dernière case se remplit) : les écrans qui ont le PIN comme dernier
 * champ s'en servent pour soumettre automatiquement, le bouton de validation
 * visible restant l'unique déclencheur accessible au clavier/lecteur d'écran. */
export function PinInput({
  id,
  ref,
  value,
  onValueChange,
  onComplete,
  error,
  autoFocus,
  disabled,
}: {
  id?: string;
  ref?: React.Ref<HTMLInputElement>;
  value: string;
  onValueChange: (value: string) => void;
  onComplete?: (value: string) => void;
  error?: boolean;
  autoFocus?: boolean;
  disabled?: boolean;
}) {
  return (
    <InputOTP
      id={id}
      ref={ref}
      maxLength={PIN_LENGTH}
      pattern={REGEXP_ONLY_DIGITS}
      inputMode="numeric"
      value={value}
      onChange={onValueChange}
      onComplete={onComplete}
      autoFocus={autoFocus}
      disabled={disabled}
      aria-invalid={error || undefined}
      containerClassName="justify-center"
    >
      <InputOTPGroup>
        {Array.from({ length: PIN_LENGTH }).map((_, index) => (
          <InputOTPSlot key={index} index={index} mask className="h-12 w-10 text-lg" />
        ))}
      </InputOTPGroup>
    </InputOTP>
  );
}
