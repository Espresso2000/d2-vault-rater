# UX review: what was messy, and what changed

A pass over the report page ([report-template/site.html](../../report-template/site.html)), the web app's sign-in shell ([web/src/shell.html](../../web/src/shell.html)) and these docs, looking for steps that were slow, hidden or duplicated. Each finding says what was wrong and what the page does now. Rating results are untouched: only the page around them changed.

## Fixed

### Re-rating was buried and doubled up

Re-reading the vault, the thing you do after every change in game, was a button inside Settings. Settings then had a second button, **Save and re-rate**, that did the same plus saving, and the docs pointed at the first one even for settings changes.

Now **Re-rate** sits in the top bar next to the Settings gear, wherever you are ([site.html:1651-1656](../../report-template/site.html#L1651-L1656)), with its progress in a message at the bottom of the screen ([site.html:1069-1074](../../report-template/site.html#L1069-L1074)). Settings keeps one button, **Save and re-rate**, in a bar that stays on screen while you scroll the form ([site.html:1692](../../report-template/site.html#L1692)).

### Finding one item took four steps

To look up a single weapon you had to open Full list, pick weapons or armor, find the search box under the quick views, and type. There was no search anywhere else.

Now the top bar has a search box on every tab; press `/` to jump to it. Typing opens the full list already filtered, on armor when only armor matches ([site.html:1436-1447](../../report-template/site.html#L1436-L1447)). Escape clears it.

### The item drawer hid the answer at the bottom

Opening a weapon showed the score, then where to get it, moving, DIM tags, facts and perks, and only then **Why**: the sentences that explain the keep or shard verdict, which is the reason you opened it.

Now **Why keep** / **Why shard** comes straight after the score, followed by Aegis's note and the perks; moving, DIM and where to get it come after ([site.html:1975](../../report-template/site.html#L1975)). Armor gets the same order ([site.html:1994](../../report-template/site.html#L1994)).

### The lock plan asked three times

Applying locks meant **Preview changes**, ticking "I checked this list", then **Apply**. The tick box repeated what the preview and the Apply button already say.

Now it is **Preview changes**, then **Apply these N lock changes** under the list ([site.html:1624-1630](../../report-template/site.html#L1624-L1630)). The safety rules are unchanged: nothing changes before Apply, only the previewed plan can be applied, and the request still carries the confirmation flag ([safety](safety.md)).

### Duplicate shortcuts and buttons

- The Overview's "Jump in" box had **Armor to shard**, the same destination and number as the **Armor to shard** tile right above it. The duplicate link is gone ([site.html:1156](../../report-template/site.html#L1156)).
- The full list had its own **Back to top** button next to **Show more**, on top of the floating **↑ Top** button. Only the floating one is left.

### Settings you could see but not reach

The Overview shows your strictness and focus as chips, but clicking them did nothing; changing them meant finding the gear. In the local and web app they now open Settings ([site.html:961](../../report-template/site.html#L961)).

### Tab order didn't follow the job

The tabs ran Overview, Weapons, Armor, RADS, Full list, Shard, Wrapped. Deciding what to keep and what to shard is the main job, so Shard now comes right after Armor, then Full list, then the extras: RADS, Wrapped and Builds ([site.html:999](../../report-template/site.html#L999)).

### Controls that didn't work, and images

- **Large / Compact on the Weapons tab did nothing** until a reload: the click handler threw before switching. It switches at once now ([site.html:1202-1208](../../report-template/site.html#L1202-L1208)).
- **Full list counts disagreed with the list.** "Duplicates to clear" counted only shard copies but opened every duplicate, and views like "Best of every type and element" said 660 weapons while showing 97. The Overview count now matches the list, and the list says "97 weapons of 660" when Show caps it ([site.html:1550-1551](../../report-template/site.html#L1550-L1551)).
- **Blurry type card banners.** Without a screenshot, a card stretched the top pick's 96 px icon across the banner and blurred it. In the web app every weapon now has its screenshot; without one, the icon sits crisp at its own size ([site.html:417-419](../../report-template/site.html#L417-L419)).
- **Images that never loaded and lag with many images**: see [caching](caching.md#in-the-page).

## Left as they are

- **Quick views in the full list and "Jump in" on the Overview overlap.** They do: Jump in is the handful you need first, quick views are the full set once you are browsing. Both open the same list, so there is one way the list works.
- **Two ways into Settings** (the gear and the `#settings` address). The address is what makes Back and bookmarks work; there is still one control on screen.
- **The CLI's copy-and-paste sign-in.** Pasting the callback address into the terminal is clumsy, but avoiding it needs a local https server for the redirect, which the web app already provides ([Run the web app on your PC](../tutorials/web-app-on-your-pc.md)).
- **The Builds tab** has its own list, editor and drawer; it reads as one flow already and wasn't changed here.

## The look

After the UX pass, the page got its own visual style in separate changes. It keeps the blue-to-green gradient and the drifting starfield, leans further into the green, and aims for a tactical, HUD-like feel that stays calm enough to read:

- **Overview tier bar.** Each tier is a segment drawn like the tier badges under it: an outline in the tier colour around a dim fill. Hovering a headline tile or armor card lights it without moving its corner ticks.
- **Perks as symbols.** Perks show as their game icons, with the name on hover and recommended ones glowing green; Settings → Display switches back to names, saved in this browser ([site.html:1078-1085](../../report-template/site.html#L1078-L1085)).
- **Wide screens use the width.** The page grows to 2400 px with a gutter that scales with the window, and from 1960 px the brand, tabs and actions share one row with the tabs spread across the middle ([site.html:722-731](../../report-template/site.html#L722-L731)).
- **Top bar in two rows, ending in a wave.** Brand, search, Re-rate and Settings sit on one slim row and the tabs on their own row below, so every tab stays visible on a laptop screen. The bar is lit by a green glow behind the brand and a gradient hairline on top, and the larger tabs mark the active one with a glowing overline ([site.html:792-803](../../report-template/site.html#L792-L803)). The bar's bottom edge is a gentle wave of three gradient strands that drift past each other at different speeds ([site.html:89-95](../../report-template/site.html#L89-L95)); it stops for people who ask their system for reduced motion.
- **Flat surfaces with HUD corners.** Cards are a faint tint with a thin border. The key panels (headline numbers, armor picks, set cards, the toolbar) have a sharp corner and a rounded one, with green corner ticks, and a soft light follows the pointer over cards ([site.html:38-43](../../report-template/site.html#L38-L43), [site.html:950-955](../../report-template/site.html#L950-L955)).
- **Readout labels.** Small labels are monospaced capitals in green or grey; headings are Space Grotesk and body text is Inter, in sentence case.
- **More room.** Sections sit further apart, each heading has a hairline running to the edge, and cards show fewer perks at once (four on the Overview's picks, three on list rows). Card grids like the Weapons tab's type cards show at most three to a row, and each type card has one row of frame and element chips.
- **A calmer full list toolbar.** Quick views are one swipeable line. Below the search, a Filter band shows the six most used filters with the rest behind "+ more", and an Order band holds sort, a single direction button and grouping; "then" only appears once you group ([site.html:1453-1498](../../report-template/site.html#L1453-L1498)).
- **New emblem.** An upside-down triangle in the blue-green gradient with a bold white EVR across it, used in the top bar and as the favicon.

The Builds tab ([web/src/builds/builds.css](../../web/src/builds/builds.css)) and the web app's sign-in screen ([web/src/shell.html](../../web/src/shell.html)) use the same colour and surface tokens, so they follow the same look.
