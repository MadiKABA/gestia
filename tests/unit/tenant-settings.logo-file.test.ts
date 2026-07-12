import { describe, expect, it } from "vitest";
import { validateLogoFile } from "@/domain/tenant-settings/logo-file";
import { ValidationError } from "@/domain/shared/errors";

describe("validateLogoFile", () => {
  it("accepte un PNG de moins de 2 Mo", () => {
    expect(() => validateLogoFile({ mimeType: "image/png", sizeBytes: 1024 * 1024 })).not.toThrow();
  });

  it("accepte un JPEG et un WEBP", () => {
    expect(() => validateLogoFile({ mimeType: "image/jpeg", sizeBytes: 100 })).not.toThrow();
    expect(() => validateLogoFile({ mimeType: "image/webp", sizeBytes: 100 })).not.toThrow();
  });

  it("rejette un format non supporté", () => {
    expect(() => validateLogoFile({ mimeType: "image/gif", sizeBytes: 100 })).toThrow(
      ValidationError,
    );
  });

  it("rejette un fichier de plus de 2 Mo", () => {
    expect(() =>
      validateLogoFile({ mimeType: "image/png", sizeBytes: 2 * 1024 * 1024 + 1 }),
    ).toThrow(ValidationError);
  });

  it("accepte exactement 2 Mo", () => {
    expect(() =>
      validateLogoFile({ mimeType: "image/png", sizeBytes: 2 * 1024 * 1024 }),
    ).not.toThrow();
  });
});
