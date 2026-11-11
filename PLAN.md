# Tank Game – Project Plan

A small online maze-tank game to play with friends. Tanks drive around a maze, bullets
bounce off walls, last tank standing wins the round. Original name and art (working title: TBD).

## Goals
- 2–8 players per room (2–4 typical), each on their own device.
- Join by link or 6-character code. Guest names only, no accounts.
- Low latency, but not production-grade: no cheat resistance, no scaling concerns.
- Free hosting.

## Architecture: peer-to-peer, hosted on GitHub Pages
- **Static site** (the whole game) hosted free on GitHub Pages.
- **PeerJS** (WebRTC data channels) connects browsers directly. PeerJS's free public
  broker is only used to introduce peers; game traffic is browser-to-browser.
- **Host = room creator.** The host's browser runs the authoritative simulation.
  Guests send inputs; the host broadcasts state snapshots.
- Room code doubles as the host's peer ID (e.g. `tankgame-K7QX2M`).
  Share link: `https://<user>.github.io/<repo>/#K7QX2M`.

### Known trade-offs (accepted)
- If the host leaves, the room ends.
- The host has zero lag; guests' lag depends on the host's connection.
- A few strict networks block direct WebRTC connections. Fix if needed: add a free TURN relay.

## Stack
| Part | Choice |
|---|---|
| Language | TypeScript |
| Build | Vite (single app, no monorepo needed) |
| Rendering | HTML5 Canvas 2D; plain HTML/CSS for menus |
| Networking | PeerJS |
| Tests | Vitest (physics + maze generation) |
| Hosting | GitHub Pages via GitHub Actions on push to `main` |
| Tools to install | Node 22 LTS (includes npm), GitHub CLI (`gh`) |

## Code layout
```
src/
  game/      # shared simulation: maze gen, tanks, bullets, collisions, rules
  net/       # PeerJS host/guest, message types, snapshots
  render/    # canvas drawing, effects
  ui/        # menus: create/join, lobby, scoreboard
  main.ts
tests/
.github/workflows/deploy.yml
```

## Netcode (kept simple)
- **Rendering is uncapped**: each client draws at its own display's max refresh rate
  (`requestAnimationFrame`: 60/144/240 Hz…), interpolating between simulation steps.
- **Simulation** runs on a fixed 60 Hz timestep (deterministic bounces, same result on every machine).
- **Network**: host sends snapshots at 60 Hz (tunable; drop to 30 Hz if host upload struggles).
- Guests predict their own tank locally, interpolate other tanks (~50–100 ms behind).
- Bullets: spawn events sent once; guests simulate bounces with the same code.

## Controls
WASD to drive, Space to fire, for every player. (Arrows + Enter exist only for offline 2-player testing.)

## Items (later)
Not built yet, but planned for: `Tank.weapon` / `Bullet.kind` (`WeaponKind` in `src/game/sim.ts`)
are where new weapons plug in; pickups will be a new list on `GameState`.

## Stages
0. **Setup** – install Node + gh, scaffold Vite/TS project, git repo, GitHub repo, Pages deploy of a "hello" page.
1. **Offline prototype** – maze gen (scales with player count), tank movement, bouncing bullets, hits; local play.
2. **Peer-to-peer** – create/join by code or link, lobby with names, host-authoritative loop.
3. **Netcode polish** – prediction, interpolation, testing with real friends / throttled network.
4. **Game rules** – rounds, scores, a few original power-ups.
5. **Polish** – original art style (pick from 2–3 mockups), effects, sound, mobile controls.
