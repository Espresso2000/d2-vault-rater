# UX review: what was messy, and what changed

A pass over the report page ([report-template/site.html](../../report-template/site.html)), the web app's sign-in shell ([web/src/shell.html](../../web/src/shell.html)) and these docs, looking for steps that were slow, hidden or duplicated. Each finding says what was wrong and what the page does now. Rating results are untouched: only the page around them changed.

## Fixed

### Re-rating was buried and doubled up

Re-reading the vault, the thing you do after every change in game, was a button inside Settings. Settings then had a second button, **Save and re-rate**, that did the same plus saving, and the docs pointed at the first one even for settings changes.

Now **Re-rate** sits in the top bar next to the Settings gear, wherever you are ([site.html:1550-1555](../../report-template/site.html#L1550-L1555)), with its progress in a message at the bottom of the screen ([site.html:988-993](../../report-template/site.html#L988-L993)). Settings keeps one button, **Save and re-rate**, in a bar that stays on screen while you scroll the form ([site.html:1588](../../report-template/site.html#L1588)).

### Finding one item took four steps

To look up a single weapon you had to open Full list, pick weapons or armor, find the search box under the quick views, and type. There was no search anywhere else.

Now the top bar has a search box on every tab; press `/` to jump to it. Typing opens the full list already filtered, on armor when only armor matches ([site.html:1346-1357](../../report-template/site.html#L1346-L1357)). Escape clears it.

### The item drawer hid the answer at the bottom

Opening a weapon showed the score, then where to get it, moving, DIM tags, facts and perks, and only then **Why**: the sentences that explain the keep or shard verdict, which is the reason you opened it.

Now **Why keep** / **Why shard** comes straight after the score, followed by Aegis's note and the perks; moving, DIM and where to get it come after ([site.html:1867](../../report-template/site.html#L1867)). Armor gets the same order ([site.html:1886](../../report-template/site.html#L1886)).

### The lock plan asked three times

Applying locks meant **Preview changes**, ticking "I checked this list", then **Apply**. The tick box repeated what the preview and the Apply button already say.

Now it is **Preview changes**, then **Apply these N lock changes** under the list ([site.html:1523-1529](../../report-template/site.html#L1523-L1529)). The safety rules are unchanged: nothing changes before Apply, only the previewed plan can be applied, and the request still carries the confirmation flag ([safety](safety.md)).

### Duplicate shortcuts and buttons

- The Overview's "Jump in" box had **Armor to shard**, the same destination and number as the **Armor to shard** tile right above it. The duplicate link is gone ([site.html:1067](../../report-template/site.html#L1067)).
- The full list had its own **Back to top** button next to **Show more**, on top of the floating **↑ Top** button. Only the floating one is left.

### Settings you could see but not reach

The Overview shows your strictness and focus as chips, but clicking them did nothing; changing them meant finding the gear. In the local and web app they now open Settings ([site.html:880](../../report-template/site.html#L880)).

### Tab order didn't follow the job

The tabs ran Overview, Weapons, Armor, RADS, Full list, Shard, Wrapped. Deciding what to keep and what to shard is the main job, so Shard now comes right after Armor, then Full list, then the extras: RADS, Wrapped and Builds ([site.html:918](../../report-template/site.html#L918)).

## Left as they are

- **Quick views in the full list and "Jump in" on the Overview overlap.** They do: Jump in is the handful you need first, quick views are the full set once you are browsing. Both open the same list, so there is one way the list works.
- **Two ways into Settings** (the gear and the `#settings` address). The address is what makes Back and bookmarks work; there is still one control on screen.
- **The CLI's copy-and-paste sign-in.** Pasting the callback address into the terminal is clumsy, but avoiding it needs a local https server for the redirect, which the web app already provides ([Run the web app on your PC](../tutorials/web-app-on-your-pc.md)).
- **The Builds tab** has its own list, editor and drawer; it reads as one flow already and wasn't changed here.

## The look

After the UX pass, the page got a lighter visual style in a separate change. It keeps the blue-to-green gradient and the drifting starfield, and uses them less:

- **Top bar in two rows.** Brand, search, Re-rate and Settings sit on one slim row and the tabs on their own row below, so every tab stays visible on a laptop screen instead of scrolling off ([site.html:726-740](../../report-template/site.html#L726-L740)). On phones the search takes the free width and the tabs swipe.
- **Flat surfaces.** Cards are a faint tint with a thin border; the glowing gradient rims, animated aurora and moving sheen are gone. The gradient marks only what matters: the brand, the active tab's underline, primary buttons and top scores ([site.html:12-15](../../report-template/site.html#L12-L15)).
- **Calmer type.** Inter for text and Space Grotesk for headings and numbers, in sentence case instead of letter-spaced capitals.
- **Quieter badges.** Tier badges are a flat tint of the tier colour, and verdicts are a coloured dot with a word.
- **A floating drawer** with rounded corners on wide screens, still a bottom sheet on phones.

The Builds tab ([web/src/builds/builds.css](../../web/src/builds/builds.css)) and the web app's sign-in screen ([web/src/shell.html](../../web/src/shell.html)) use the same colour and surface tokens, so they follow the same look.
