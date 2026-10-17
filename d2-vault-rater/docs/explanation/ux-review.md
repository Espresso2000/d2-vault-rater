# UX review: what was messy, and what changed

A pass over the report page ([report-template/site.html](../../report-template/site.html)), the web app's sign-in shell ([web/src/shell.html](../../web/src/shell.html)) and these docs, looking for steps that were slow, hidden or duplicated. Each finding says what was wrong and what the page does now. Rating results are untouched: only the page around them changed.

## Fixed

### Re-rating was buried and doubled up

Re-reading the vault, the thing you do after every change in game, was a button inside Settings. Settings then had a second button, **Save and re-rate**, that did the same plus saving, and the docs pointed at the first one even for settings changes.

Now **Re-rate** sits in the top bar next to the Settings gear, wherever you are ([site.html:1919-1924](../../report-template/site.html#L1919-L1924)), with its progress in a message at the bottom of the screen ([site.html:1217-1222](../../report-template/site.html#L1217-L1222)). Settings keeps one button, **Save and re-rate**, in a bar that stays on screen while you scroll the form ([site.html:1960](../../report-template/site.html#L1960)).

### Finding one item took four steps

To look up a single weapon you had to open Full list, pick weapons or armor, find the search box under the quick views, and type. There was no search anywhere else.

Now the top bar has a search box on every tab; press `/` to jump to it. Typing opens the full list already filtered, on armor when only armor matches ([site.html:1686-1698](../../report-template/site.html#L1686-L1698)). Escape clears it.

### The item drawer hid the answer at the bottom

Opening a weapon showed the score, then where to get it, moving, DIM tags, facts and perks, and only then **Why**: the sentences that explain the keep or shard verdict, which is the reason you opened it.

Now **Why keep** / **Why shard** comes straight after the score, followed by Aegis's note and the perks; moving, DIM and where to get it come after ([site.html:2244](../../report-template/site.html#L2244)). Armor gets the same order ([site.html:2263](../../report-template/site.html#L2263)).

### The lock plan asked three times

Applying locks meant **Preview changes**, ticking "I checked this list", then **Apply**. The tick box repeated what the preview and the Apply button already say.

Now it is **Preview changes**, then **Apply these N lock changes** under the list ([site.html:1892-1898](../../report-template/site.html#L1892-L1898)). The safety rules are unchanged: nothing changes before Apply, only the previewed plan can be applied, and the request still carries the confirmation flag ([safety](safety.md)).

### Duplicate shortcuts and buttons

- The Overview's "Jump in" box had **Armor to shard**, the same destination and number as the **Armor to shard** tile right above it. The duplicate link is gone ([site.html:1303](../../report-template/site.html#L1303)).
- The full list had its own **Back to top** button next to **Show more**, on top of the floating **↑ Top** button. Only the floating one is left.

### Settings you could see but not reach

The Overview shows your strictness and focus as chips, but clicking them did nothing; changing them meant finding the gear. In the local and web app they now open Settings ([site.html:1065](../../report-template/site.html#L1065)).

### Tab order didn't follow the job

The tabs ran Overview, Weapons, Armor, RADS, Full list, Shard, Wrapped. Deciding what to keep and what to shard is the main job, so Shard now comes right after Armor, then Full list, then the extras: RADS, Wrapped and Builds ([site.html:1103](../../report-template/site.html#L1103)).

### Controls that didn't work, and images

- **Large / Compact on the Weapons tab did nothing** until a reload: the click handler threw before switching. It switches at once now ([site.html:1349-1355](../../report-template/site.html#L1349-L1355)).
- **Full list counts disagreed with the list.** "Duplicates to clear" counted only shard copies but opened every duplicate, and views like "Best of every type and element" said 660 weapons while showing 97. The Overview count now matches the list, and the list says "97 weapons of 660" when Show caps it ([site.html:1809-1810](../../report-template/site.html#L1809-L1810)).
- **Blurry type card banners.** Without a screenshot, a card stretched the top pick's 96 px icon across the banner and blurred it. In the web app every weapon now has its screenshot; without one, the icon sits crisp at its own size ([site.html:462-464](../../report-template/site.html#L462-L464)).
- **Images that never loaded and lag with many images**: see [caching](caching.md#in-the-page).

### Builds took one drawer per slot

Every socket, weapon, armor piece and mod opened its own drawer: pick, confirm, close, then the next slot. Filling a build meant twenty-odd round trips.

Now subclass slots open a popover in place on hover, keyboard focus or tap, with the options, their Aegis tiers and Destiny Clarity's notes; aspects and fragments toggle, so one popover fills every slot ([web/src/builds/ui.ts:655](../../web/src/builds/ui.ts#L655), [web/src/builds/ui.ts:767](../../web/src/builds/ui.ts#L767)). Weapons, armor and mods for all slots come from one filterable list with a live stat preview, and **Apply** saves them in one go ([web/src/builds/ui.ts:936](../../web/src/builds/ui.ts#L936), [web/src/builds/ui.ts:1204](../../web/src/builds/ui.ts#L1204)). The rating, stats, set bonuses and the equip and DIM buttons sit in a summary column ([web/src/builds/ui.ts:362](../../web/src/builds/ui.ts#L362)). See [the Builds tab](builds-tab.md#the-editor).

## Left as they are

- **Quick views in the full list and "Jump in" on the Overview overlap.** They do: Jump in is the handful you need first, quick views are the full set once you are browsing. Both open the same list, so there is one way the list works.
- **Two ways into Settings** (the gear and the `#settings` address). The address is what makes Back and bookmarks work; there is still one control on screen.
- **The CLI's copy-and-paste sign-in.** Pasting the callback address into the terminal is clumsy, but avoiding it needs a local https server for the redirect, which the web app already provides ([Run the web app on your PC](../tutorials/web-app-on-your-pc.md)).

## The look

After the UX pass, the page got its own visual style in separate changes. It keeps the blue-to-green gradient and the drifting starfield, leans further into the green, and aims for a tactical, HUD-like feel that stays calm enough to read:

- **Overview tier bar.** Each tier is a segment drawn like the tier badges under it: an outline in the tier colour around a dim fill. Hovering a headline tile or armor card lights it without moving its corner ticks.
- **Perks as symbols.** Cards and rows show the perks equipped on each gun, in the game's order (barrel, magazine, the two traits, origin trait), as round icons with the name on hover and recommended ones ringed green. The item drawer lists every option per column with the equipped one lit ([site.html:1234-1240](../../report-template/site.html#L1234-L1240)). Settings → Display switches back to names, saved in this browser ([site.html:1226-1233](../../report-template/site.html#L1226-L1233)).
- **Vault tab.** Full list is now a mode of the Vault tab. Its other mode lays out each character's weapons beside the vault, by slot, as DIM does; dragging a weapon moves it (or equips it, on the big slot) through the same move call as the drawer, with progress in a corner message ([site.html:1587-1685](../../report-template/site.html#L1587-L1685)).
- **Pinned, condensable toolbar.** The Vault tab's search, filter and sort toolbar stays pinned under the top bar while you scroll. Buttons on it switch between Full (the bands), 2 lines (search, then filters, sort and the count on one sideways-scrolling line; the default) and 1 line ([site.html:354](../../report-template/site.html#L354)). Vault mode uses the same weapon filters and sort, and by default splits the vault column into one group per weapon type ([site.html:1643-1652](../../report-template/site.html#L1643-L1652)).
- **Wide screens use the width.** The page grows to 2400 px with a gutter that scales with the window, and from 1960 px the brand, tabs and actions share one row with the tabs spread across the middle ([site.html:821-830](../../report-template/site.html#L821-L830)).
- **Top bar in two rows, ending in a wave.** Brand, search, Re-rate and Settings sit on one slim row and the tabs on their own row below, so every tab stays visible on a laptop screen. The bar is lit by a green glow behind the brand and a gradient hairline on top, and the larger tabs mark the active one with a glowing overline ([site.html:891-902](../../report-template/site.html#L891-L902)). The bar's bottom edge is a gentle wave of three gradient strands that drift past each other at different speeds ([site.html:89-95](../../report-template/site.html#L89-L95)); it stops for people who ask their system for reduced motion.
- **Flat surfaces with HUD corners.** Cards are a faint tint with a thin border. The key panels (headline numbers, armor picks, set cards, the toolbar) have a sharp corner and a rounded one, with green corner ticks, and a soft light follows the pointer over cards ([site.html:38-43](../../report-template/site.html#L38-L43), [site.html:1054-1059](../../report-template/site.html#L1054-L1059)).
- **Readout labels.** Small labels are monospaced capitals in green or grey; headings are Space Grotesk and body text is Inter, in sentence case.
- **More room.** Sections sit further apart, each heading has a hairline running to the edge, and cards show fewer perks at once (four on the Overview's picks, three on list rows). Card grids like the Weapons tab's type cards show at most three to a row, and each type card has one row of frame and element chips.
- **A calmer full list toolbar.** Quick views are one swipeable line. Below the search, a Filter band shows the six most used filters with the rest behind "+ more", and an Order band holds sort, a single direction button and grouping; "then" only appears once you group ([site.html:1704-1755](../../report-template/site.html#L1704-L1755)).
- **New emblem.** An upside-down triangle in the blue-green gradient with a bold white EVR across it, used in the top bar and as the favicon.

The Builds tab ([web/src/builds/builds.css](../../web/src/builds/builds.css)) and the web app's sign-in screen ([web/src/shell.html](../../web/src/shell.html)) use the same colour and surface tokens, so they follow the same look.
