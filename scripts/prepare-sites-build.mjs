import { mkdir, writeFile } from "node:fs/promises";

const serverDirectory = new URL("../dist/server/", import.meta.url);

await mkdir(serverDirectory, { recursive: true });

await writeFile(
  new URL("index.js", serverDirectory),
  `export default {
  fetch(request, env) {
    return env.ASSETS.fetch(request);
  },
};
`,
);

await writeFile(
  new URL("wrangler.json", serverDirectory),
  `${JSON.stringify(
    {
      main: "index.js",
      compatibility_date: "2026-08-31",
      assets: {
        directory: "../client",
        binding: "ASSETS",
        not_found_handling: "single-page-application",
      },
    },
    null,
    2,
  )}\n`,
);
