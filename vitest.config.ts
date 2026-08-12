import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["src/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: ["src/lib/**/*.ts"],
      exclude: [
        "src/lib/schedule-engine.ts",
        "src/lib/prisma.ts",
        "src/lib/auth.ts",
        // Reine Prisma-Abfragen ohne eigene Logik (die Regeln dazu liegen in
        // zeitplan-sperre.ts, zeitplan-aktualitaet.ts und mittagsplanung.ts und
        // sind dort vollständig getestet).
        "src/lib/zeitplan-config.ts",
        "src/lib/zeitplan-eingaben.ts",
      ],
      thresholds: {
        statements: 80,
        branches: 80,
        functions: 80,
        lines: 80,
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
});
