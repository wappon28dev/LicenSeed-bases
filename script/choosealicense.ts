import { join } from "path";
import { Glob } from "bun";
import { parse, stringify } from "yaml";
import { load } from "cheerio";

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

export type SeedDef = {
  id: string;
  name: string;
  description: string;
  summary: {
    permissions: Array<{
      type: string;
      value: string;
    }>;
    limitations: Array<{
      type: string;
      value: string;
    }>;
    conditions: Array<{
      type: string;
      value: string;
    }>;
  };
  variables: Array<{
    key: string;
    description: string;
  }>;
  body: string;
};

function license2seedDef(
  license: License,
  variables: string[],
  body: string,
): SeedDef {
  const { title, description, permissions, conditions, limitations } = license;

  return {
    id: ["@software", license["spdx-id"]].join("/"),
    name: title,
    description: description.replaceAll("\n", ""),
    summary: {
      permissions: permissions.map((value) => ({
        type: "TERM",
        value,
      })),
      limitations: limitations.map((value) => ({
        type: "TERM",
        value,
      })),
      conditions: conditions.map((value) => ({
        type: "TERM",
        value,
      })),
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

  const seedDef = license2seedDef(parse(meta), variables, body);

  const modifiedSeedDef = {
    ...seedDef,
    description: anchor2text(seedDef.description),
  } as const satisfies SeedDef;

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
