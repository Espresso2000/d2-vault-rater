import { defineConfig, type Plugin } from "vite";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import basicSsl from "@vitejs/plugin-basic-ssl";
import { localBungie, localPort } from "./local-server.ts";

const here = import.meta.dirname;
const srcDir = resolve(here, "../src");
const key = (p: string) => p.replace(/\\/g, "/").toLowerCase();

/** The rater's Node-only modules, swapped for browser versions. Everything else in ../src is used as is. */
const SHIMS: Record<string, string> = Object.fromEntries(
  [
    ["config.ts", "config.ts"],
    ["bungie/client.ts", "client.ts"],
    ["bungie/oauth.ts", "oauth.ts"],
    ["bungie/manifest.ts", "manifest.ts"],
    ["dim/sync.ts", "sync.ts"],
  ].map(([from, to]) => [key(resolve(srcDir, from)), resolve(here, "src/shims", to)]),
);

function shims(): Plugin {
  return {
    name: "vault-rater-shims",
    enforce: "pre",
    async resolveId(source, importer, opts) {
      if (source.startsWith("node:")) return resolve(here, "src/shims/node.ts");
      if (!importer) return null;
      const r = await this.resolve(source, importer, { ...opts, skipSelf: true });
      return (r && SHIMS[key(r.id)]) || null;
    },
  };
}

/** The page is the local app's report template plus the sign-in shell and the app script. */
function reportPage(): Plugin {
  return {
    name: "vault-rater-page",
    transformIndexHtml: {
      order: "pre",
      handler() {
        const tpl = readFileSync(resolve(here, "../report-template/site.html"), "utf8");
        const shell = readFileSync(resolve(here, "src/shell.html"), "utf8");
        return tpl
          .replace("__TITLE__", "Vault Rater")
          .replace("</head>", `<meta name="description" content="Rate your Destiny 2 vault against Aegis's tier list.">\n<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='7' fill='%230a1130'/%3E%3Cpath d='M8 9l8 15 8-15' fill='none' stroke='%2333e3a0' stroke-width='3.2' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E">\n</head>`)
          .replace("<body>", `<body class="vr-booting">\n${shell}`)
          .replace(/<\/body>\s*<\/html>\s*$/, `<script type="module" src="/src/main.ts"></script>\n</body>\n</html>\n`);
      },
    },
  };
}

// `--mode localhost`: https on the Bungie app's localhost redirect port, plus the token relay.
export default defineConfig(({ mode }) => {
  const local = mode === "localhost";
  return {
    base: "./",
    plugins: [shims(), reportPage(), ...(local ? [basicSsl(), localBungie()] : [])],
    server: { port: local ? localPort() : 5173, strictPort: true, fs: { allow: [resolve(here, "..")] } },
    preview: { port: local ? localPort() : 4173, strictPort: true },
    build: { outDir: "dist", emptyOutDir: true, target: "es2022", chunkSizeWarningLimit: 1200 },
    worker: { format: "es" },
  };
});
