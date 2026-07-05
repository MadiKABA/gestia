import argon2 from "argon2";
import type { Hasher } from "@/application/auth/hasher";

export class Argon2Hasher implements Hasher {
  async hash(value: string): Promise<string> {
    return argon2.hash(value);
  }

  async verify(hash: string, value: string): Promise<boolean> {
    return argon2.verify(hash, value);
  }
}
