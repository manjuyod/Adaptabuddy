import { readFileSync } from "fs";
import { describe, expect, it } from "vitest";
import { validateTemplatesAgainstSchema } from "@/lib/wizard/template-normalization";

const loadJsonArray = (path: string) => JSON.parse(readFileSync(path, "utf-8")) as unknown[];

describe("template normalization fixtures", () => {
  it("validates canonical normalized templates file", () => {
    const templates = loadJsonArray("supabase/templates.normalized.json");
    expect(() =>
      validateTemplatesAgainstSchema(
        templates
          .map((entry) => (entry as { template_json?: unknown }).template_json)
          .filter(Boolean)
      )
    ).not.toThrow();
  });

  it("captures drift in normalization migration payload", () => {
    const migrationSql = readFileSync("supabase/migrations/02_template_normalization.sql", "utf-8");
    const match = migrationSql.match(/\[\s*\{[\s\S]*\}\s*\]/);
    expect(match, "expected migration to embed normalized template JSON array").toBeTruthy();
    if (!match) return;
    const parsed = JSON.parse(match[0]) as unknown[];
    expect(() =>
      validateTemplatesAgainstSchema(
        parsed
          .map((entry) => (entry as { template_json?: unknown }).template_json)
          .filter(Boolean)
      )
    ).not.toThrow();
  });
});
