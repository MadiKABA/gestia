import { ValidationError } from "@/domain/shared/errors";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateEmailFormat(email: string): void {
  if (!EMAIL_REGEX.test(email)) {
    throw new ValidationError("L'adresse email n'est pas valide");
  }
}
