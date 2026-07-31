import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import pluginReact from "eslint-plugin-react";
import pluginReactHooks from "eslint-plugin-react-hooks";
import prettierConfig from "eslint-config-prettier";
import { defineConfig } from "eslint/config";

export default defineConfig([
  { ignores: ["**/dist/**", "**/build/**", "**/node_modules/**", "**/.venv/**"] },
  { files: ["**/*.{js,mjs,cjs,ts,mts,cts,jsx,tsx}"], plugins: { js }, extends: ["js/recommended"] },
  tseslint.configs.recommended,
  {
    files: ["frontend/**/*.{js,jsx,ts,tsx}"],
    languageOptions: { globals: globals.browser },
    extends: [
      pluginReact.configs.flat.recommended,
      pluginReact.configs.flat["jsx-runtime"],
      pluginReactHooks.configs.flat.recommended,
    ],
    settings: { react: { version: "detect" } },
  },
  {
    files: ["blockchain/besu/**/*.{js,mjs,cjs}"],
    languageOptions: { globals: globals.node },
  },
  prettierConfig,
]);
