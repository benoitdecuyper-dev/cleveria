import { defineConfig } from "vitest/config";

// Tests unitaires des fonctions pures (lib/). Les tests E2E Playwright vivent dans
// e2e/ et sont lancés séparément (npm run test:e2e), pas par Vitest.
export default defineConfig({
  test: {
    include: ["lib/**/*.test.ts"],
    environment: "node",
  },
});
