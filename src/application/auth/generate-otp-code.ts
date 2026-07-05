import { randomInt } from "node:crypto";

export function generateOtpCode(length: number): string {
  let code = "";
  for (let i = 0; i < length; i++) {
    code += randomInt(0, 10).toString();
  }
  return code;
}
