import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "out/**",
      "build/**",
      "next-env.d.ts",
    ],
  },
  {
    files: ["**/*.{js,jsx,ts,tsx}"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: "CallExpression[callee.object.name='localStorage'][callee.property.name='getItem']",
          message: "Use persist utils instead of direct localStorage.getItem()"
        },
        {
          selector: "CallExpression[callee.object.name='localStorage'][callee.property.name='setItem']",
          message: "Use persist utils instead of direct localStorage.setItem()"
        }
      ]
    }
  },
  {
    files: ["src/lib/persist/**/*.{js,jsx,ts,tsx}"],
    rules: {
      "no-restricted-syntax": "off"
    }
  }
];

export default eslintConfig;
