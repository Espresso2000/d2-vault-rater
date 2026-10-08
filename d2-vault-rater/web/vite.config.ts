import { defineConfig, normalizePath, type Plugin } from "vite";
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
  ].map(([from, to]) => [key(resolve(srcDir, from)), normalizePath(resolve(here, "src/shims", to))]),
);

function shims(): Plugin {
  return {
    name: "vault-rater-shims",
    enforce: "pre",
    async resolveId(source, importer, opts) {
      // Forward slashes, so a shim is the same module however it is imported.
      if (source.startsWith("node:")) return normalizePath(resolve(here, "src/shims/node.ts"));
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
          .replace("</head>", `<meta name="description" content="Rate your Destiny 2 vault against Aegis's tier list.">\n</head>`)
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
    // VR_NO_SSL=1 serves plain http (for browsers that refuse the self-signed certificate; sign-in still needs https).
    plugins: [shims(), reportPage(), ...(local ? [...(process.env.VR_NO_SSL ? [] : [basicSsl()]), localBungie()] : [])],
    server: { port: local ? localPort() : 5173, strictPort: true, fs: { allow: [resolve(here, "..")] } },
    preview: { port: local ? localPort() : 4173, strictPort: true },
    build: { outDir: "dist", emptyOutDir: true, target: "es2022", chunkSizeWarningLimit: 1200 },
    worker: { format: "es" },
  };
});
