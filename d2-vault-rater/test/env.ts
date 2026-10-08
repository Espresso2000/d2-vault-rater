import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

process.env.VAULT_RATER_HOME = mkdtempSync(join(tmpdir(), "vault-rater-test-"));
