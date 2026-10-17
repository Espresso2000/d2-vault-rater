/** Shared "waiting for data" block: a spinner, a title and optional detail text. Styles are in loading.css. */
import "./loading.css";
import { esc } from "./html";

export const loadingBlock = (title: string, detail = "") =>
  `<div class="vr-loading" role="status" aria-live="polite"><span class="vr-spin" aria-hidden="true"></span>
    <div><b>${esc(title)}</b>${detail ? `<p>${esc(detail)}</p>` : ""}</div></div>`;
