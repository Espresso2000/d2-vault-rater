/**
 * The browser-safe parts of the Bungie client: the error type, throttle retries and URL helper.
 * client.ts (Node) and the web app's client shim both re-export these.
 */
export const BUNGIE = "https://www.bungie.net";
export class BungieError extends Error {
    errorCode;
    errorStatus;
    throttleSeconds;
    constructor(errorCode, errorStatus, message, throttleSeconds = 0) {
        super(`${errorStatus} (${errorCode}): ${message}`);
        this.errorCode = errorCode;
        this.errorStatus = errorStatus;
        this.throttleSeconds = throttleSeconds;
    }
}
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
/** Run a Bungie call, waiting and retrying (up to 4 times) while Bungie says it is throttled, like DIM does. */
export async function retryThrottled(call) {
    for (let attempt = 0;; attempt++) {
        try {
            return await call();
        }
        catch (e) {
            const throttle = e instanceof BungieError && (e.throttleSeconds > 0 || /throttl/i.test(e.errorStatus));
            if (!throttle || attempt >= 4)
                throw e;
            await sleep(Math.max(1, e.throttleSeconds) * 1000 * (attempt + 1));
        }
    }
}
/** A bungie.net path ("/common/...") as a full URL; full URLs pass through, empty stays empty. */
export const bungieUrl = (path) => (path ? (path.startsWith("http") ? path : BUNGIE + path) : "");
//# sourceMappingURL=errors.js.map