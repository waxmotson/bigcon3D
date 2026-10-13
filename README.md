# THE BIG CON 3D — Battle Royale

A multiplayer first-person battle royale built on the rules of **THE BIG CON**. Up to 24 cons (8 humans + bots) drop from the Qantas jet onto the giant evidence board, seize exhibits, collect income, raise their Cortisol, dodge regulator raids — and shoot each other as the dragnet closes in.

**Play:** serve the folder over HTTP (e.g. GitHub Pages, or `python3 -m http.server`) and open `index.html`. Desktop browser with mouse + keyboard. Opening via `file://` won't load the card images.

## Characters
Drop a `.png` into the `characters/` folder and commit it. On the next page load the lobby automatically picks it up (via the public GitHub API) and makes it available as a selectable face. The filename (without extension, lowercased) becomes the internal id; a pretty name is generated from it. The original 8 characters are bundled as a fallback if the API is unreachable.

## How the original mechanics map across

| THE BIG CON | THE BIG CON 3D |
|---|---|
| The evidence board (2400×1560) | A 480×312 m arena; every exhibit is a giant pinned card on a post |
| Red threads between exhibits | Red threads on the floor — sprint lanes (+12% speed) |
| Seize an exhibit / hostile takeover | Stand in the ring and **hold E**. Rival takeovers cost double (and keep doubling), pay the owner a buyout, +2 Cortisol |
| Income at the start of your turn | A 20-second **market tick** — every player collects (salary + holdings + all synergies) |
| Cortisol, raids at 8 | Same. Raid = two best exhibits seized, 30% fine, Intel burned, **cuffed 7s** (slowed, weapons locked) |
| Market Event deck (25 cards) | One event every ~38 s, same cards and effects; markets moods (CALM/BOOM/PANIC/FRENZY) tint the sky |
| Intel & node powers (Spy, Dossier, Leak, Audit, Tweet, Spin, Cook the Books, Fly the Jet, Budget Night…) | **The Con Menu (Q)** — same powers, cooldowns instead of "once per turn" |
| Bugs | Stand at a rival exhibit, press **B** |
| Quikstop (moves each game) | Buy health, armor, ammo, grenades there |
| Win: $ target **and** one of every node type | Still a win condition — **or** be the last con standing |
| — | The dragnet (shrinking zone): exhibits outside it fall to the regulators; outside it you bleed health and Cortisol |
| — | The richest con is **WANTED** — visible on every map |
| — | Bust a con: take 35% of their cash; the rest drops as a briefcase; their exhibits go back to the regulators |

## Controls
`WASD` move · `Shift` sprint · `Space` jump / leave the jet · `C` crouch · `LMB` fire · `RMB` aim · `R` reload · `1-5` weapons / wheel · `G` MARGIN CALL (grenade) · `Hold E` seize · `B` bug · `Q` Con Menu · `M` evidence-board map · `Enter` chat · `N` music

## Weapons
The Stapler · Ticker Tape (SMG) · The Cash Rate (rifle) · Yield Curve (shotgun) · The Short Seller (sniper)

## Multiplayer
Peer-to-peer via PeerJS, same JTPortal buzzword room codes as v1.5. One browser hosts and runs the simulation; others join by code. Solo mode (vs bots) needs no network. Bots fill the jet up to 24 and take over seats of dropped players.

The host is authoritative for money, Intel, Cortisol, ownership, health, the dragnet and the event deck. Clients own their own movement and aim; the host validates every shot (rate, range, proximity) and every deal (position, price). This is a casual-play trust model, not anti-cheat.

Connection reliability has been improved (explicit PeerJS cloud host, immediate data listeners, hello retry).

## Layout
```
index.html          page + HUD markup
css/style.css
js/data.js          exhibits, threads, moods, 25-card deck + auto-loaded characters
js/econ.js          income + seizure pricing (verbatim from v1.5)
js/world.js         arena, collision, raycasts, weapons table
js/core.js          host simulation: damage, zone, ticks, events, abilities, win checks
js/bots.js          bot AI
js/net.js           PeerJS lobby + messaging
js/render.js        three.js renderer
js/ui.js            HUD, Con Menu, maps, audio
js/main.js          player controller + frame loop
```
Assets (`static/`, `characters/`, logos) are shared with the original repo.
