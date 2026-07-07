"use client";

import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/presentation/shared/components/ui/input-otp";
import { OTP_LENGTH } from "@/domain/auth/otp";

/** Saisie du code OTP en cases séparées — avance auto d'une case à l'autre,
 * support du collage d'un code SMS complet (géré nativement par `input-otp`).
 * `onComplete` sert à déplacer le focus vers le champ suivant du formulaire
 * (PIN) : aucun écran de Gestia n'a l'OTP comme dernier champ, donc pas de
 * soumission automatique du formulaire — le bouton de validation visible
 * reste le seul déclencheur de soumission. */
export function OtpInput({
  id,
  value,
  onValueChange,
  onComplete,
  error,
  autoFocus,
  disabled,
}: {
  id?: string;
  value: string;
  onValueChange: (value: string) => void;
  onComplete?: () => void;
  error?: boolean;
  autoFocus?: boolean;
  disabled?: boolean;
}) {
  return (
    <InputOTP
      id={id}
      maxLength={OTP_LENGTH}
      value={value}
      onChange={onValueChange}
      onComplete={onComplete}
      autoFocus={autoFocus}
      disabled={disabled}
      aria-invalid={error || undefined}
      containerClassName="justify-center"
    >
      <InputOTPGroup>
        {Array.from({ length: OTP_LENGTH }).map((_, index) => (
          <InputOTPSlot key={index} index={index} className="h-12 w-10 text-lg" />
        ))}
      </InputOTPGroup>
    </InputOTP>
  );
}
