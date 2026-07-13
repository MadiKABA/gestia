import { describe, expect, it } from "vitest";
import { validateLogoFile } from "@/domain/tenant-settings/logo-file";
import { ValidationError } from "@/domain/shared/errors";

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const JPEG_SIGNATURE = [0xff, 0xd8, 0xff, 0xe0];
const WEBP_SIGNATURE = [
  0x52,
  0x49,
  0x46,
  0x46, // "RIFF"
  0x00,
  0x00,
  0x00,
  0x00, // taille du chunk (non vérifiée)
  0x57,
  0x45,
  0x42,
  0x50, // "WEBP"
];

function bytes(...values: number[]): Uint8Array {
  return new Uint8Array([...values, ...Array.from({ length: 100 }, () => 0)]);
}

describe("validateLogoFile", () => {
  it("accepte un PNG de moins de 2 Mo avec un en-tête PNG réel", () => {
    expect(() =>
      validateLogoFile({
        mimeType: "image/png",
        sizeBytes: 1024 * 1024,
        content: bytes(...PNG_SIGNATURE),
      }),
    ).not.toThrow();
  });

  it("accepte un JPEG et un WEBP avec un en-tête réel", () => {
    expect(() =>
      validateLogoFile({
        mimeType: "image/jpeg",
        sizeBytes: 100,
        content: bytes(...JPEG_SIGNATURE),
      }),
    ).not.toThrow();
    expect(() =>
      validateLogoFile({
        mimeType: "image/webp",
        sizeBytes: 100,
        content: bytes(...WEBP_SIGNATURE),
      }),
    ).not.toThrow();
  });

  it("rejette un format non supporté", () => {
    expect(() =>
      validateLogoFile({ mimeType: "image/gif", sizeBytes: 100, content: bytes(0x47, 0x49, 0x46) }),
    ).toThrow(ValidationError);
  });

  it("rejette un fichier de plus de 2 Mo", () => {
    expect(() =>
      validateLogoFile({
        mimeType: "image/png",
        sizeBytes: 2 * 1024 * 1024 + 1,
        content: bytes(...PNG_SIGNATURE),
      }),
    ).toThrow(ValidationError);
  });

  it("accepte exactement 2 Mo", () => {
    expect(() =>
      validateLogoFile({
        mimeType: "image/png",
        sizeBytes: 2 * 1024 * 1024,
        content: bytes(...PNG_SIGNATURE),
      }),
    ).not.toThrow();
  });

  it("rejette un mimeType déclaré qui ne correspond pas au contenu réel (régression contournement upload)", () => {
    // mimeType falsifié en "image/png" mais contenu réellement autre chose
    // (ex. un script ou un fichier arbitraire construit hors navigateur).
    expect(() =>
      validateLogoFile({
        mimeType: "image/png",
        sizeBytes: 100,
        content: new TextEncoder().encode("#!/bin/sh\necho not an image"),
      }),
    ).toThrow(ValidationError);
  });

  it("rejette un contenu PNG réel déclaré sous un autre mimeType", () => {
    expect(() =>
      validateLogoFile({
        mimeType: "image/jpeg",
        sizeBytes: 100,
        content: bytes(...PNG_SIGNATURE),
      }),
    ).toThrow(ValidationError);
  });
});
