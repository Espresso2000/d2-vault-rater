/**
 * Encounters for every raid and dungeon, with what each one asks of your loadout.
 * Researched against community guides (Shacknews, Destructoid, Grindout, Deltia's Gaming,
 * Game Rant's Monument of Triumph DPS picks); Monument of Triumph (June 2026) is the final sandbox.
 */
export const ROLE_LABEL = {
    "boss-burst": "Burst DPS",
    "boss-sustained": "Sustained DPS",
    precision: "Precision",
    "add-clear": "Add clear",
    range: "Long range",
    close: "Close range",
    sword: "Sword DPS",
    support: "Support",
};
/** Weapon types that fill each role, with how well they fit (1 = ideal). */
export const ROLE_TYPES = {
    "boss-burst": { "Rocket Launcher": 1, "Linear Fusion Rifle": 1, "Grenade Launcher": 0.9, "Sniper Rifle": 0.85, "Fusion Rifle": 0.75, Sword: 0.75, "Machine Gun": 0.7 },
    "boss-sustained": { "Machine Gun": 1, "Linear Fusion Rifle": 1, Sword: 0.95, "Trace Rifle": 0.9, "Grenade Launcher": 0.9, "Rocket Launcher": 0.85, "Sniper Rifle": 0.8 },
    precision: { "Sniper Rifle": 1, "Linear Fusion Rifle": 1, "Scout Rifle": 0.85, "Pulse Rifle": 0.8, "Hand Cannon": 0.8, "Trace Rifle": 0.8, "Combat Bow": 0.8 },
    "add-clear": { "Submachine Gun": 1, "Auto Rifle": 1, "Grenade Launcher": 0.95, "Pulse Rifle": 0.9, "Machine Gun": 0.9, "Hand Cannon": 0.85, Sidearm: 0.85, "Trace Rifle": 0.85, Glaive: 0.85, "Combat Bow": 0.8, "Fusion Rifle": 0.75, Shotgun: 0.7 },
    range: { "Scout Rifle": 1, "Sniper Rifle": 1, "Linear Fusion Rifle": 0.95, "Pulse Rifle": 0.9, "Combat Bow": 0.9, "Hand Cannon": 0.6 },
    close: { Shotgun: 1, "Fusion Rifle": 0.9, "Submachine Gun": 0.9, Glaive: 0.9, Sword: 0.85 },
    sword: { Sword: 1, Glaive: 0.6 },
    support: {},
};
/** Final-sandbox picks guides agree on for each role (Game Rant, Gaming ProMax, Aegis's notes). */
export const ROLE_META = {
    "boss-burst": ["Gjallarhorn", "Still Hunt", "Cataclysmic", "Whisper of the Worm", "Two-Tailed Fox", "Fafnir", "Edge Transit", "Apex Predator", "Hezen Vengeance", "Dragon's Breath", "Parasite", "Whirling Ovation"],
    "boss-sustained": ["Microcosm", "Fafnir", "Cataclysmic", "Euphony", "Finality's Auger", "Pro Memoria", "Ergo Sum", "Whisper of the Worm", "Thunderlord", "Xenophage"],
    precision: ["Still Hunt", "Outbreak Perfected", "Thunderlord", "Conspiracy Honed", "Whisper of the Worm", "Cataclysmic", "Briar's Contempt"],
    "add-clear": ["Outbreak Perfected", "Choir of One", "Mint Retrograde", "Lost Signal", "Mida Mini-Tool", "Sunshot", "Trinity Ghoul", "Witherhoard"],
    range: ["Outbreak Perfected", "Choir of One", "Conspiracy Honed", "Still Hunt", "Le Monarque"],
    close: ["Conditional Finality", "Unvoiced", "Heritage", "Matador 64", "Mint Retrograde"],
    sword: ["Ergo Sum", "Bequest", "Falling Guillotine", "Lament"],
    support: ["Divinity", "Tractor Cannon", "Witherhoard"],
};
export const ENCOUNTERS = {
    "desert-perpetual": [
        { name: "Iatros, Inward-Turned", kind: "boss", tip: "A huge Wyvern in a small arena full of enemies: a survival test with a firm DPS check. Bring heavy you can fire for the whole window.", roles: ["boss-sustained", "add-clear", "support"], meta: ["Microcosm", "Fafnir"] },
        { name: "Agraios, Inherent", kind: "boss", tip: "Clear Minotaurs, Wyverns and the Hydra to build buffs, then block the boss's laser with the detain bubble to open DPS. The health pool rewards a perfect damage phase.", roles: ["boss-burst", "add-clear", "precision"], meta: ["Gjallarhorn", "Cataclysmic"] },
        { name: "Epoptes, Lord of Quanta", kind: "boss", tip: "Precision damage wins here: guides recommend Outbreak Perfected, Thunderlord, trace rifles and Kinetic sniper rifles, with Golden Gun Hunters on Still Hunt.", roles: ["precision", "boss-sustained", "add-clear"], meta: ["Outbreak Perfected", "Thunderlord", "Still Hunt", "Conspiracy Honed"] },
        { name: "Koregos, The Worldline", kind: "boss", tip: "The final boss unlocks after the other three. Short, intense damage windows: front-load burst damage.", roles: ["boss-burst", "add-clear", "support"], meta: ["Whirling Ovation", "Gjallarhorn", "Cataclysmic"] },
    ],
    "salvations-edge": [
        { name: "Substratum", kind: "mechanics", tip: "Constant add pressure while carrying out the shape mechanics. Strong primary and special ad clear keeps the team alive.", roles: ["add-clear", "range", "boss-sustained"] },
        { name: "Herald of Finality (Dissipation)", kind: "boss", tip: "Swords excel during damage, especially with one player on Ergo Sum's Wolfpack Rounds buffing everyone's Legendary swords. Bring self-healing for the solo phases.", roles: ["sword", "add-clear", "range"], meta: ["Ergo Sum", "Bequest", "Falling Guillotine"] },
        { name: "Repository", kind: "mechanics", tip: "Mechanic-heavy room clearing with Tormentors and constant adds. Add clear and a dependable heavy matter more than raw DPS.", roles: ["add-clear", "boss-sustained", "close"] },
        { name: "Verity", kind: "mechanics", tip: "A communication puzzle with long sightlines between rooms. Ranged special and steady add clear.", roles: ["range", "add-clear", "precision"] },
        { name: "Zenith (The Witness)", kind: "boss", tip: "The final fight hinges on hitting crit glyphs and bursting the Witness during short windows. Precision and burst heavy, with Divinity if anyone has it.", roles: ["precision", "boss-burst", "support"], meta: ["Still Hunt", "Cataclysmic", "Divinity", "Euphony"] },
    ],
    "crotas-end": [
        { name: "The Abyss", kind: "traversal", tip: "Run the lantern chain through the dark while Thralls swarm you. Fast ad clear and mobility.", roles: ["add-clear", "close", "range"] },
        { name: "The Bridge", kind: "mechanics", tip: "Sword bearers, Ogres and Knights on a long bridge. Kill the Ogres fast and keep lanes clear.", roles: ["add-clear", "boss-burst", "range"] },
        { name: "Ir Yût, the Deathsinger", kind: "boss", tip: "Wizards and Shriekers chip you down while you race a wipe timer. Burst the Deathsinger as soon as she is exposed.", roles: ["boss-burst", "add-clear", "precision"], meta: ["Gjallarhorn", "Cataclysmic"] },
        { name: "Crota, Son of Oryx", kind: "boss", tip: "Break Crota's shield with heavy, then the sword bearer swings. Burst heavy for the shield phase, ad clear for the Swordbearers and Thralls.", roles: ["boss-burst", "add-clear", "support"], meta: ["Gjallarhorn", "Apex Predator"] },
    ],
    "root-of-nightmares": [
        { name: "Cataclysm", kind: "mechanics", tip: "Node-linking mechanics under steady enemy pressure. Add clear and a reliable primary.", roles: ["add-clear", "range", "boss-sustained"] },
        { name: "Scission", kind: "mechanics", tip: "Split team on two sides of the arena, shooting nodes at range. Long-range primaries and specials.", roles: ["range", "add-clear", "precision"] },
        { name: "Macrocosm", kind: "boss", tip: "Planets and pulses, then a burst damage window on the boss. Rockets and linear fusions shine.", roles: ["boss-burst", "add-clear", "support"], meta: ["Gjallarhorn", "Cataclysmic"] },
        { name: "Nezarec, Final God of Pain", kind: "boss", tip: "Long, moving damage phases on a big crit spot. Linear fusions, rockets and Divinity are classic choices.", roles: ["boss-sustained", "precision", "add-clear"], meta: ["Cataclysmic", "Briar's Contempt", "Divinity", "Still Hunt"] },
    ],
    "kings-fall": [
        { name: "Basilica (Totems)", kind: "mechanics", tip: "Brand-swapping on the totems while Hive pour in. Steady add clear.", roles: ["add-clear", "range", "close"] },
        { name: "Warpriest", kind: "boss", tip: "A short damage window after glyphs and the plate sequence. Burst heavy on his crit.", roles: ["boss-burst", "precision", "add-clear"], meta: ["Gjallarhorn", "Cataclysmic", "Still Hunt"] },
        { name: "Golgoroth", kind: "boss", tip: "Damage from the pool while holding his gaze. Long, stationary DPS: linear fusions, machine guns and heavy grenade launchers.", roles: ["boss-sustained", "add-clear", "support"], meta: ["Cataclysmic", "Microcosm", "Fafnir"] },
        { name: "Daughters of Oryx", kind: "boss", tip: "Torn between platforms; damage the sisters in short bursts from the Brand of the Unraveler. Burst heavy.", roles: ["boss-burst", "precision", "add-clear"], meta: ["Gjallarhorn", "Cataclysmic"] },
        { name: "Oryx, the Taken King", kind: "boss", tip: "Detonate the Light bombs then burst Oryx while he is stunned. Rockets and linear fusions on his chest.", roles: ["boss-burst", "add-clear", "support"], meta: ["Gjallarhorn", "Cataclysmic", "Apex Predator"] },
    ],
    "vow-of-the-disciple": [
        { name: "Acquisition", kind: "mechanics", tip: "Symbol callouts and an Abomination to kill each phase. Add clear plus heavy that deletes the Abomination quickly.", roles: ["add-clear", "boss-burst", "range"] },
        { name: "The Caretaker", kind: "boss", tip: "A mobile boss you stun and chip in short bursts across floors. Precision and burst while moving.", roles: ["precision", "boss-burst", "add-clear"], meta: ["Cataclysmic", "Still Hunt"] },
        { name: "Exhibition", kind: "mechanics", tip: "Portal and symbol work under constant enemy fire. Add clear and survivability.", roles: ["add-clear", "range", "close"] },
        { name: "Rhulk, Disciple of the Witness", kind: "boss", tip: "Long damage phases that move around the arena. Linear fusions and rockets on his head.", roles: ["boss-sustained", "precision", "add-clear"], meta: ["Cataclysmic", "Briar's Contempt", "Still Hunt"] },
    ],
    "vault-of-glass": [
        { name: "Confluxes", kind: "mechanics", tip: "Stop sacrificing Vex at the confluxes. Pure add clear.", roles: ["add-clear", "range", "close"] },
        { name: "Oracles", kind: "mechanics", tip: "Call and shoot the oracles in order while adds flood in. Ranged precision and add clear.", roles: ["range", "add-clear", "precision"] },
        { name: "The Templar", kind: "boss", tip: "Detain the Templar, cleanse, then burst it. Short, stationary damage window.", roles: ["boss-burst", "add-clear", "range"], meta: ["Gjallarhorn", "Hezen Vengeance"] },
        { name: "Gorgons' Labyrinth", kind: "traversal", tip: "Sneak past the Gorgons; fighting is optional. Bring a fast primary for stragglers.", roles: ["add-clear", "range", "close"] },
        { name: "Gatekeepers", kind: "mechanics", tip: "Wyverns, Minotaurs and portals across three rooms. Add clear and burst special for majors.", roles: ["add-clear", "boss-burst", "close"] },
        { name: "Atheon, Time's Conflux", kind: "boss", tip: "Brief damage windows after the oracles. Rockets with Bait and Switch, linear fusions and heavy grenade launchers.", roles: ["boss-burst", "add-clear", "support"], meta: ["Hezen Vengeance", "Gjallarhorn", "Cataclysmic"] },
    ],
    "deep-stone-crypt": [
        { name: "Crypt Security", kind: "boss", tip: "Operator, Scanner and Suppressor roles; the boss's fuses take short burst windows. Linear fusions and snipers on the panels.", roles: ["boss-burst", "precision", "add-clear"], meta: ["Cataclysmic", "Still Hunt"] },
        { name: "Atraks-1, Fallen Exo", kind: "boss", tip: "Clones on two floors; damage is short and mobile. Rockets and heavy grenade launchers.", roles: ["boss-burst", "add-clear", "range"], meta: ["Gjallarhorn", "Apex Predator"] },
        { name: "The Descent (Rapture)", kind: "mechanics", tip: "Nuclear cores and Servitors on the station. Add clear and range.", roles: ["add-clear", "range", "close"] },
        { name: "Taniks, the Abomination", kind: "boss", tip: "Taniks stays mobile with thrusters to break. Long range burst while chasing him.", roles: ["boss-burst", "range", "add-clear"], meta: ["Gjallarhorn", "Cataclysmic"] },
    ],
    "garden-of-salvation": [
        { name: "Evade the Consecrated Mind", kind: "traversal", tip: "Tether chain under fire. Add clear while you move.", roles: ["add-clear", "range", "close"] },
        { name: "Summon the Consecrated Mind", kind: "mechanics", tip: "Defend tethers and hold relays. Steady add clear.", roles: ["add-clear", "range", "boss-sustained"] },
        { name: "Consecrated Mind, Sol Inherent", kind: "boss", tip: "Damage the eye in short windows. Precision burst; Divinity was made for this raid.", roles: ["precision", "boss-burst", "support"], meta: ["Divinity", "Still Hunt", "Cataclysmic"] },
        { name: "Sanctified Mind, Sol Inherent", kind: "boss", tip: "Longer damage on a moving crit. Linear fusions and snipers with Divinity.", roles: ["precision", "boss-sustained", "add-clear"], meta: ["Divinity", "Cataclysmic", "Still Hunt"] },
    ],
    "last-wish": [
        { name: "Kalli, the Corrupted", kind: "boss", tip: "Stand on the plates and burst Kalli between her teleports. Rockets and linear fusions.", roles: ["boss-burst", "add-clear", "precision"], meta: ["Gjallarhorn", "Apex Predator"] },
        { name: "Shuro Chi, the Corrupted", kind: "boss", tip: "Snipers on high ledges and a mid-range boss. Long range special and sustained heavy.", roles: ["boss-sustained", "range", "add-clear"], meta: ["Cataclysmic", "Still Hunt"] },
        { name: "Morgeth, the Spirekeeper", kind: "boss", tip: "A giant Ogre with a huge health pool. Stationary sustained damage: machine guns and linear fusions.", roles: ["boss-sustained", "add-clear", "support"], meta: ["Microcosm", "Fafnir"] },
        { name: "The Vault", kind: "mechanics", tip: "Symbols and Knights in three rooms. Add clear and burst special for Knights.", roles: ["add-clear", "close", "boss-burst"] },
        { name: "Riven of a Thousand Voices", kind: "boss", tip: "Damage her open mouth (and eye) in short windows. Precision burst: Whisper, snipers, linear fusions.", roles: ["precision", "boss-burst", "support"], meta: ["Whisper of the Worm", "Still Hunt", "Cataclysmic", "Divinity"] },
        { name: "Queenswalk", kind: "traversal", tip: "Carry the heart while everything shoots you. Add clear and survivability.", roles: ["add-clear", "close", "range"] },
    ],
    equilibrium: [
        { name: "The Harvester", kind: "mechanics", tip: "Build Gathering Shadows to break Nameless Apprentice shields, then take down the Behemoths. Add clear plus heavy for the Behemoths.", roles: ["add-clear", "boss-burst", "range"] },
        { name: "Harrow, Dredgen Apprentice", kind: "boss", tip: "A fast dual-blade Gladiator. Stay mobile and burst during openings.", roles: ["boss-burst", "close", "add-clear"], meta: ["Parasite", "Gjallarhorn"] },
        { name: "Dredgen Sere", kind: "boss", tip: "The final fight against Bael's lieutenant. Guides lean on Parasite, Pro Memoria and Finality's Auger for heavy.", roles: ["boss-burst", "add-clear", "precision"], meta: ["Parasite", "Pro Memoria", "Finality's Auger", "Still Hunt"] },
    ],
    "sundered-doctrine": [
        { name: "Solve the Riddle", kind: "mechanics", tip: "A light-beam puzzle with Hive pressure. Ranged primaries and add clear.", roles: ["add-clear", "range", "precision"] },
        { name: "Zoetic Lockset", kind: "mechanics", tip: "Shoot the right lock symbols while adds push. Precision and range.", roles: ["precision", "add-clear", "boss-burst"] },
        { name: "Kerrev, the Erased", kind: "boss", tip: "Sustained boss damage between mechanic phases. Finality's Auger drops here and suits the fight.", roles: ["boss-sustained", "add-clear", "precision"], meta: ["Finality's Auger", "Cataclysmic"] },
    ],
    "vespers-host": [
        { name: "Activation", kind: "mechanics", tip: "Restart the station's systems under constant Fallen and Vex fire. Add clear.", roles: ["add-clear", "range", "close"] },
        { name: "Raneiks Unified", kind: "boss", tip: "Activate the panels to unify the boss, then hit fast and hard. Guides favour Parasite and Dragon's Breath with Weapon Surge and Tractor Cannon.", roles: ["boss-burst", "support", "add-clear"], meta: ["Parasite", "Dragon's Breath", "Tractor Cannon"] },
        { name: "Insurrection Prime", kind: "boss", tip: "The final boss, with weak points to break before each damage phase. Precision and burst heavy.", roles: ["boss-burst", "precision", "add-clear"], meta: ["Cataclysmic", "Gjallarhorn"] },
    ],
    "warlords-ruin": [
        { name: "Rathil, First Broken Knight of Fikrul", kind: "boss", tip: "Taken totems and the Imminent Wish buff, then burst Rathil. Burst heavy and add clear.", roles: ["boss-burst", "add-clear", "range"], meta: ["Gjallarhorn", "Apex Predator"] },
        { name: "Locus of Wailing Grief", kind: "boss", tip: "An Ogre boss with totem mechanics. Sustained heavy in the damage phase.", roles: ["boss-sustained", "add-clear", "close"], meta: ["Microcosm", "Fafnir"] },
        { name: "Hefnd's Vengeance, Blighted Chimaera", kind: "boss", tip: "The final boss: mobile with plenty of adds. Burst heavy and strong add clear.", roles: ["boss-burst", "add-clear", "range"], meta: ["Gjallarhorn", "Cataclysmic"] },
    ],
    "ghosts-of-the-deep": [
        { name: "The Ritual", kind: "mechanics", tip: "Disrupt the Hive ritual; plenty of Knights and Wizards. Add clear.", roles: ["add-clear", "range", "close"] },
        { name: "Ecthar, Shield of Savathûn", kind: "boss", tip: "Short burst windows between mechanic phases. Rockets and linear fusions.", roles: ["boss-burst", "add-clear", "precision"], meta: ["Gjallarhorn", "Cataclysmic"] },
        { name: "Šimmumah ur-Nokru", kind: "boss", tip: "The final boss with a long damage phase and plenty of adds. Sustained heavy.", roles: ["boss-sustained", "add-clear", "precision"], meta: ["Cataclysmic", "Microcosm"] },
    ],
    "spire-of-the-watcher": [
        { name: "Ascent", kind: "mechanics", tip: "Climb the spire powering arc relays under a timer. Add clear and mobility.", roles: ["add-clear", "range", "close"] },
        { name: "Akelous, the Siren's Current", kind: "boss", tip: "A Hydra with short damage windows. Burst heavy.", roles: ["boss-burst", "precision", "add-clear"], meta: ["Gjallarhorn", "Cataclysmic"] },
        { name: "Persys, Primordial Ruin", kind: "boss", tip: "Damage from multiple platforms as Persys turns. Precision and burst.", roles: ["precision", "boss-burst", "add-clear"], meta: ["Cataclysmic", "Still Hunt"] },
    ],
    duality: [
        { name: "Nightmare of Gahlran", kind: "boss", tip: "Find the real Gahlran and burst him. Precision burst on a mobile target.", roles: ["precision", "boss-burst", "add-clear"], meta: ["Cataclysmic", "Still Hunt"] },
        { name: "The Vault", kind: "mechanics", tip: "Bell and symbol mechanics with adds. Add clear.", roles: ["add-clear", "range", "close"] },
        { name: "Nightmare of Caiatl", kind: "boss", tip: "Caiatl stands still during damage; long DPS phases suit machine guns and linear fusions.", roles: ["boss-sustained", "add-clear", "support"], meta: ["Microcosm", "Cataclysmic", "Fafnir"] },
    ],
    "grasp-of-avarice": [
        { name: "Phry'zhia the Insatiable", kind: "boss", tip: "A huge Ogre; stationary damage with relic mechanics. Sustained heavy.", roles: ["boss-sustained", "add-clear", "support"], meta: ["Microcosm", "Fafnir"] },
        { name: "Fallen Shield", kind: "mechanics", tip: "Cannon work against a Fallen shield and lots of Fallen. Add clear.", roles: ["add-clear", "range", "boss-burst"] },
        { name: "Captain Avarokk, the Covetous", kind: "boss", tip: "Burst the Captain during his damage phases while the team handles the relic mechanics. Burst heavy.", roles: ["boss-burst", "add-clear", "precision"], meta: ["Gjallarhorn", "Cataclysmic"] },
    ],
    prophecy: [
        { name: "Phalanx Echo", kind: "boss", tip: "Short damage windows on a shielded Cabal. Burst heavy.", roles: ["boss-burst", "add-clear", "precision"], meta: ["Gjallarhorn", "Apex Predator"] },
        { name: "Hexahedron", kind: "mechanics", tip: "The rotating cube with lots of shooting at range. Add clear and range.", roles: ["add-clear", "range", "close"] },
        { name: "Kell Echo", kind: "boss", tip: "Damage phases from multiple angles. Precision burst.", roles: ["boss-burst", "precision", "add-clear"], meta: ["Cataclysmic", "Still Hunt"] },
    ],
    "pit-of-heresy": [
        { name: "Necropolis", kind: "mechanics", tip: "Fight through crypt rooms to the gate. Add clear.", roles: ["add-clear", "close", "range"] },
        { name: "Chamber of Suffering", kind: "mechanics", tip: "Orb dunking with Ogres and Knights. Add clear and burst special.", roles: ["add-clear", "boss-burst", "close"] },
        { name: "Harrow", kind: "traversal", tip: "Navigate the labyrinth. Bring a fast primary.", roles: ["add-clear", "close", "range"] },
        { name: "Zulmak, Instrument of Torment", kind: "boss", tip: "Damage Zulmak while managing the orbs. Burst heavy in short windows.", roles: ["boss-burst", "add-clear", "precision"], meta: ["Gjallarhorn", "Xenophage"] },
    ],
    "shattered-throne": [
        { name: "Vorgeth, the Boundless", kind: "boss", tip: "A big Ogre in the Dreaming City throne. Sustained heavy.", roles: ["boss-sustained", "add-clear", "support"], meta: ["Microcosm", "Fafnir"] },
        { name: "Dul Incaru, the Eternal Return", kind: "boss", tip: "A mobile final boss with Knights and Wizards. Burst heavy and strong add clear.", roles: ["boss-burst", "add-clear", "precision"], meta: ["Gjallarhorn", "Cataclysmic"] },
    ],
};
//# sourceMappingURL=encounters.js.map