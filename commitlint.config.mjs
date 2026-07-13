/**
 * Conventional Commits. Types en anglais (feat, fix, chore...), description en français.
 * Jamais de trailer Co-Authored-By ni de mention d'IA dans les messages.
 */
const config = {
  extends: ["@commitlint/config-conventional"],
  rules: {
    "scope-enum": [
      2,
      "always",
      [
        "setup",
        "tooling",
        "env",
        "schema",
        "architecture",
        "party",
        "transaction",
        "payment",
        "cash",
        "tenant-settings",
        "layout",
        "auth",
        "audit-log",
        "offline-sync",
        "pwa",
        "ci",
        "docker",
        "docs",
        "deps",
        "landing",
        "routing",
        "ui",
      ],
    ],
    "subject-case": [0],
  },
};

export default config;
