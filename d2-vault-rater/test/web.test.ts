import "./env.js";
import { test } from "node:test";
import assert from "node:assert/strict";
import { canSignIn, type Tokens } from "../web/src/shims/client.js";

test("web sign-in: an expired access token is fine while the refresh token is still good", () => {
  const now = Date.now();
  const t = (access: number, refresh: number, refresh_token = "r"): Tokens => ({ access_token: "a", refresh_token, access_expires_at: now + access, refresh_expires_at: now + refresh, membership_id: "1" });
  assert.equal(canSignIn(null, now), false);
  assert.equal(canSignIn(t(3_600_000, 3_600_000), now), true);
  assert.equal(canSignIn(t(-1000, 86_400_000), now), true, "the local app's refresh token renews it");
  assert.equal(canSignIn(t(-1000, -1000), now), false);
  assert.equal(canSignIn(t(-1000, 86_400_000, ""), now), false, "a public client has no refresh token");
});

test("web manifest snapshot: its name carries the strip format, so an older-format snapshot is not used", async () => {
  const { MANIFEST_SNAPSHOT } = await import("../web/src/strip.js");
  const { STRIP_FORMAT } = await import("../src/bungie/strip.js");
  assert.equal(MANIFEST_SNAPSHOT, `manifest-v${STRIP_FORMAT}`);
});
