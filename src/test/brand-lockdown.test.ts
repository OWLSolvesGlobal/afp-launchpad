import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * Brand lockdown guardrail.
 *
 * The brand is two fonts (Inter + Fraunces) and two colors (ink black +
 * safety red via the --accent token). This test fails the build if any of
 * the retired systems creep back in: the old turquoise/lime hexes, the
 * Oswald/Stardos fonts and their utility classes, raw neutral-* Tailwind
 * greys on pages, the dropped "Unstoppable YOU" voice, the pre-launch
 * US-store copy, or the wrong WhatsApp number.
 */

const BANNED: Array<{ pattern: RegExp; why: string }> = [
  { pattern: /#00b5e2/i, why: "old TURQUOISE hex — accent is the safety-red token" },
  { pattern: /#c5e86c/i, why: "old LIME hex — accent is the safety-red token" },
  { pattern: /#25d366/i, why: "WhatsApp green — FABs/buttons use brand tokens" },
  { pattern: /Oswald/, why: "retired font — Inter + Fraunces only" },
  { pattern: /Stardos/, why: "retired font — Inter + Fraunces only" },
  { pattern: /font-stencil/, why: "retired font utility" },
  { pattern: /font-display/, why: "retired font utility — use display-lg/md" },
  { pattern: /font-heading/, why: "retired font utility" },
  { pattern: /\bneutral-\d/, why: "raw Tailwind grey — use the ink/bone/graphite tokens" },
  { pattern: /Unstoppable/i, why: "retired tagline — the voice is 'For the life you live'" },
  { pattern: /worldwide/i, why: "we deliver island-wide in Barbados, not worldwide" },
  { pattern: /\bEST\b/, why: "US timezone from template copy — Barbados store" },
  { pattern: /SS26/, why: "stale drop copy" },
  { pattern: /8364327/, why: "wrong WhatsApp number — the number is 246-252-0102 (brand.ts)" },
];

// shadcn/ui primitives and test files are not brand surface.
const SKIP_DIRS = new Set(["ui", "__snapshots__"]);
const EXTENSIONS = new Set([".ts", ".tsx", ".css", ".html"]);

function collectFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (!SKIP_DIRS.has(entry)) collectFiles(full, out);
    } else if (
      [...EXTENSIONS].some((ext) => entry.endsWith(ext)) &&
      !entry.includes(".test.")
    ) {
      out.push(full);
    }
  }
  return out;
}

describe("brand lockdown", () => {
  const root = join(__dirname, "..", "..");
  const files = [...collectFiles(join(root, "src")), join(root, "index.html")];

  it("scans a sane number of source files", () => {
    expect(files.length).toBeGreaterThan(20);
  });

  for (const { pattern, why } of BANNED) {
    it(`bans ${pattern} (${why})`, () => {
      const offenders = files
        .map((f) => ({ f, text: readFileSync(f, "utf8") }))
        .filter(({ text }) => pattern.test(text))
        .map(({ f }) => f.slice(root.length + 1));
      expect(offenders, `${why}; found in: ${offenders.join(", ")}`).toEqual([]);
    });
  }

  it("locks the Google Fonts import to Inter + Fraunces with italics", () => {
    const css = readFileSync(join(root, "src", "index.css"), "utf8");
    const importLine = css.split("\n")[0];
    expect(importLine).toContain("Fraunces:ital");
    expect(importLine).toContain("Inter");
  });
});
