/**
 * Netlify Functions are bundled by esbuild outside Next.js, where a "server-only" import throws.
 * Bundle each function the way Netlify does and import it (ledger GFS-21).
 */
import { build } from "esbuild";
import { mkdtempSync, readdirSync, rmSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { afterAll, describe, expect, it } from "vitest";

const out = mkdtempSync(path.join(process.cwd(), ".fntest-"));
afterAll(() => rmSync(out, { recursive: true, force: true }));

describe("Netlify functions bundle and load", () => {
  for (const file of readdirSync("netlify/functions").filter((f) => f.endsWith(".mts"))) {
    it(file, async () => {
      const outfile = path.join(out, file.replace(/\.mts$/, ".mjs"));
      await build({
        entryPoints: [path.join("netlify/functions", file)],
        bundle: true,
        platform: "node",
        format: "esm",
        outfile,
        logLevel: "silent",
        external: ["@electric-sql/pglite", "@node-rs/argon2"],
        alias: { "@": process.cwd() },
        banner: { js: "import { createRequire } from 'module'; const require = createRequire(import.meta.url);" },
      });
      const mod = await import(pathToFileURL(outfile).href);
      expect(typeof mod.default).toBe("function");
      expect(mod.config).toBeTruthy();
    }, 60_000);
  }
});
