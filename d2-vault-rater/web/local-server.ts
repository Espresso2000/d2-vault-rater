/**
 * Running the web app on your own PC (`npm run local`), with the Confidential Bungie app the local
 * app already uses. The page itself still does everything in the browser; this server only:
 *   GET  /app-config.json  hands the page the API key and client id from ../.env (not secret)
 *   POST /oauth/token      relays Bungie's token exchange, adding the client secret, so the secret
 *                          stays in .env and never reaches the page
 * Hosted on a static server instead, the page uses a Public Bungie app and needs neither.
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { Connect, Plugin } from "vite";

export function readEnv(): Record<string, string> {
  const file = resolve(import.meta.dirname, "..", ".env");
  const out: Record<string, string> = {};
  if (existsSync(file))
    for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
      if (m && m[2]) out[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  return { ...out, ...Object.fromEntries(Object.entries(process.env).filter(([k, v]) => k.startsWith("BUNGIE_") && v)) } as Record<string, string>;
}

/** Port of the redirect URL registered on the Bungie app (https://localhost:7777/callback by default). */
export function localPort(): number {
  try {
    return Number(new URL(readEnv().BUNGIE_REDIRECT_URL || "https://localhost:7777/callback").port) || 443;
  } catch {
    return 7777;
  }
}

const readBody = (req: Connect.IncomingMessage) =>
  new Promise<string>((ok) => {
    let b = "";
    req.on("data", (c) => (b += c)).on("end", () => ok(b));
  });

function middleware(): Connect.NextHandleFunction {
  return async (req, res, next) => {
    const path = (req.url || "").split("?")[0];
    if (req.method === "GET" && path.endsWith("/app-config.json")) {
      const env = readEnv();
      res.setHeader("Content-Type", "application/json");
      res.setHeader("Cache-Control", "no-store");
      return res.end(JSON.stringify({ bungieApiKey: env.BUNGIE_API_KEY || "", bungieClientId: env.BUNGIE_CLIENT_ID || "", tokenEndpoint: env.BUNGIE_CLIENT_SECRET ? "oauth/token" : "" }));
    }
    if (req.method === "POST" && path.endsWith("/oauth/token")) {
      // Only this page may use the relay.
      const origin = req.headers.origin;
      // HTTP/2 (what Vite uses over https) sends :authority instead of Host.
      const host = req.headers.host || (req.headers[":authority"] as string | undefined);
      if (origin && origin !== `https://${host}`) return (res.statusCode = 403), res.end("Wrong origin");
      const env = readEnv();
      const body = new URLSearchParams(await readBody(req));
      const grant = body.get("grant_type");
      if (grant !== "authorization_code" && grant !== "refresh_token") return (res.statusCode = 400), res.end("Unsupported grant");
      const form = new URLSearchParams({ grant_type: grant, ...(grant === "authorization_code" ? { code: body.get("code") || "" } : { refresh_token: body.get("refresh_token") || "" }) });
      const r = await fetch("https://www.bungie.net/Platform/App/OAuth/Token/", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "X-API-Key": env.BUNGIE_API_KEY || "",
          Authorization: "Basic " + Buffer.from(`${env.BUNGIE_CLIENT_ID}:${env.BUNGIE_CLIENT_SECRET}`).toString("base64"),
        },
        body: form.toString(),
      });
      res.statusCode = r.status;
      res.setHeader("Content-Type", r.headers.get("content-type") || "application/json");
      return res.end(await r.text());
    }
    next();
  };
}

export function localBungie(): Plugin {
  return {
    name: "vault-rater-local-bungie",
    configureServer: (s) => void s.middlewares.use(middleware()),
    configurePreviewServer: (s) => void s.middlewares.use(middleware()),
  };
}
