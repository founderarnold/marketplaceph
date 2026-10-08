import { config } from "dotenv";
import path from "node:path";
import { defineConfig } from "vitest/config";

// Integration tests talk to the LOCAL Supabase stack (npx supabase start).
config({ path: ".env.development.local" });

export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname) } },
  test: {
    include: ["tests/**/*.test.ts"],
    testTimeout: 20_000,
    // Integration tests share one database; run files one at a time.
    fileParallelism: false,
  },
});
