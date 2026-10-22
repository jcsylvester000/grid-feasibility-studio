import cwv from "eslint-config-next/core-web-vitals";
import ts from "eslint-config-next/typescript";

const config = [
  ...cwv,
  ...ts,
  { ignores: [".next/**", "node_modules/**", "lib/contract/types.gen.ts", "playwright-report/**", "test-results/**", "netlify/**"] },
];
export default config;
