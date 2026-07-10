import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Serwist compiles these from app/sw.ts at build time — generated, minified, not ours to
    // lint. The source we own is app/sw.ts, which is linted normally.
    "public/sw.js",
    "public/sw.js.map",
    "public/swe-worker-*.js",
  ]),
]);

export default eslintConfig;
