import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/consistent-type-imports": "error",
      "@typescript-eslint/no-floating-promises": "off",
      "no-console": ["warn", { allow: ["warn", "error"] }],
    },
  },
  {
    // Scripts CLI (seed...) : les logs de progression sont légitimes.
    files: ["prisma/**"],
    rules: {
      "no-console": "off",
    },
  },
  {
    // Les repositories sont le seul endroit autorisé à importer Prisma directement.
    files: ["src/domain/**", "src/application/**", "src/presentation/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@/infrastructure/prisma/client",
              message:
                "Le domaine/l'application/la présentation ne doivent jamais importer Prisma directement : passez par un repository de src/infrastructure.",
            },
          ],
          patterns: [
            {
              group: ["**/generated/prisma*", "@prisma/client"],
              message: "Prisma ne doit être importé que dans src/infrastructure.",
            },
          ],
        },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
