import { join } from "path";
import { Glob } from "bun";
import { parse, stringify } from "yaml";
import { load } from "cheerio";
import type { SeedBase } from "./assets/bindings";

export type License = {
  title: string;
  "spdx-id": string;
  featured: boolean;
  hidden: boolean;
  description: string;
  how: string;
  using: Record<string, string>;
  permissions: Array<string>;
  conditions: Array<string>;
  limitations: Array<string>;
  translate: {
    ja: string;
  };
};

function license2seedBase(
  license: License,
  variables: string[],
  body: string,
): SeedBase {
  const { title, description, permissions, conditions, limitations } = license;

  return {
    id: ["@software", license["spdx-id"]].join("/"),
    name: title,
    description: description.replaceAll("\n", ""),
    summary: {
      permissions: permissions.map((key) => ({
        type: "TERM",
        key,
      })),
      limitations: limitations.map((key) => ({
        type: "TERM",
        key,
      })),
      conditions: conditions.map((key) => ({
        type: "TERM",
        key,
      })),
      notes: null,
    },
    variables: variables.map((v) => ({
      key: v,
      description: "",
    })),
    body: ".\n" + body.trim(),
  };
}

function distinct<T>(array: T[]): T[] {
  return [...new Set(array)];
}

function anchor2text(text: string): string {
  const $ = load(text);
  $("a").each((_, el) => {
    const $el = $(el);
    $el.replaceWith($el.text());
  });

  return $.text();
}

async function process(fileName: string): Promise<void> {
  const file = Bun.file(join("./assets/_licenses", fileName));
  const text = await file.text();
  const section = text.split("---\n");
  const [_, meta, ..._body] = section;
  const body = _body.join("");

  const variables = distinct(
    (body.match(/\[.*?\]/g) ?? []).map((v) => v.slice(1, -1)),
  );

  const seedBase = license2seedBase(parse(meta), variables, body);

  const modifiedSeedDef = {
    ...seedBase,
    description: anchor2text(seedBase.description),
  } as const satisfies SeedBase;

  await Bun.write(
    join(
      __dirname,
      "..",
      "bases",
      "@software",
      fileName.replace(/\.txt$/, ".yml"),
    ),
    stringify(modifiedSeedDef, {
      lineWidth: 0,
    }),
  );
}

const glob = new Glob("*.txt");
for await (const fileName of glob.scan(
  join(__dirname, "assets", "_licenses"),
)) {
  await process(fileName);
}

// await process("0bsd.txt");
