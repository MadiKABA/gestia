import { describe, expect, it } from "vitest";
import { cn } from "@/lib/utils";

describe("cn", () => {
  it("fusionne les classes et résout les conflits Tailwind", () => {
    expect(cn("px-2 py-1", "px-4")).toBe("py-1 px-4");
  });

  it("ignore les valeurs falsy", () => {
    expect(cn("text-sm", false, undefined, null, "font-bold")).toBe("text-sm font-bold");
  });
});
