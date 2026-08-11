# COLDWAKE — Design Spec v0.1

*Working title. Fits the SALTBONE / COLDSTORE / DEEPFALL / DUSTOFF naming pattern; swap freely.*

**Genre:** Co-op 3D Metroidvania survival. 1–4 players. Mobile-first, Quest 3 VR secondary.
**Stack:** Single-file HTML, Three.js r128 (CDN), host-authoritative WebRTC with Upstash KV relay fallback, share-code save/resume.
**Pillars:** Repair-gated exploration · crystal-run risk/reward · three timed boss encounters · ignition endgame.

---

## 1. Premise

You wake in a failed cryopod aboard the colony transport *Coldwake*, drifting dark. The crew is gone. Something is nesting in the ship. Three critical components have been dragged into the nests of three hive matriarchs, and the only thing that penetrates their carapace is a charge rifle powered by Voidglass — unstable crystal that only grows in the ship's breached sectors, and that the hive can smell from three decks away.

Restore the reactor. Restore the drive. Restore navigation. Burn for Earth.

---

## 2. Core Loop

```
Explore sector → find repair node → node is missing a part
   ├─ Part is scrap/craftable → gather → repair → new sector powered
   └─ Part is boss-held → need charge rifle → need Voidglass
        → crystal run into a breach zone (timer + escalating aggro)
        → return to bench → charge rifle → boss encounter (timed)
        → part → repair → new sector powered → repeat
```

Every completed node visibly changes the ship: lights come on, fans spin, doors cycle, ambient hum layers in. This is the primary reward feedback — cheaper than loot and far more satisfying in a fixed-map game.

---

## 3. Sector Map

Nine sectors on a spine. Power tier gates access.

| # | Sector | Role | Gate |
|---|--------|------|------|
| 0 | **Cryobay** | Spawn / safe hub / rifle bench | — |
| 1 | **Spinal Corridor** | Central artery, connects all | — |
| 2 | **Hydroponics** | Crystal Zone A (low danger) | — |
| 3 | **Medbay** | Fabricator / crafting hub | Power T1 |
| 4 | **Reactor Core** | Repair N2 · **Boss 1 arena** | — |
| 5 | **Cargo Ring** | Crystal Zone B (rotating hazard) | Power T1 |
| 6 | **Drive Bay** | Repair N5 · **Boss 2 arena** | Power T1 |
| 7 | **Hull Spine (EVA)** | Crystal Zone C (suit timer) | Power T2 + N6 |
| 8 | **Bridge** | Repair N7, N8 · **Boss 3 arena** | Power T2 |

**Power tiers.** T1 from Boss 1's Coolant Regulator, T2 from Boss 2's Drive Coupling, T3 from Boss 3's Nav Core. Power is the Metroidvania key — no key items, no fetch inventory, just "is this sector energised."

---

## 4. Repair-Node Dependency Graph

```
N0 Emergency Lighting ──┐
   (4 Scrap)            │
                        ▼
N1 Atmosphere Scrubber ─────► removes global O2 drain
   (8 Scrap, 2 Filter Mesh)
                        │
                        ▼
N2 Coolant Regulator ◄── BOSS 1 PART ──► POWER T1
                        │
        ┌───────────────┼───────────────┐
        ▼               ▼               ▼
N3 Fabricator      N4 Ring Brake    N5 Drive Coupling ◄── BOSS 2 PART
  (12 Scrap)       (10 Scrap,          │                  ──► POWER T2
  ►rifle upgrades   1 Servo)           │
  ►tier-2 craft     ►Zone B safe       ▼
                                  N6 Airlock Cycler ──► Zone C (EVA)
                                     (2 Servo)
                                       │
                                       ▼
                                  N7 Nav Core ◄── BOSS 3 PART ──► POWER T3
                                       │
                                       ▼
                                  N8 IGNITION  ← WIN
                              (N0–N7 complete + 3 charged crystals)
```

**N8 is a defence encounter, not a cutscene.** Drive spin-up runs 180s; the hive throws everything at the bridge. Charged crystals are consumed as emergency shield pulses. This is the climax — don't make it a button press.

---

## 5. Crystal Economy

Voidglass is the whole tension system now that PvP is gone. Numbers are starting points to tune, not gospel.

| Zone | Crystals/incursion | Aggro mult | Hazard |
|------|--------------------|-----------|--------|
| A — Hydroponics | 2–3 | ×1.5 | Spore clouds, vision |
| B — Cargo Ring | 3–4 | ×2.0 | Rotating crush (until N4) |
| C — Hull Spine | 4–6 | ×2.5 | Suit integrity 180s |

**Hot crystal aggro.** Extracting a crystal makes it *hot*. Hive alert level rises with the number of hot crystals carried, across the whole party:

- **Alert 0** — baseline spawns
- **Alert 1** (1–2 hot) — spawn rate ×1.5
- **Alert 2** (3–4 hot) — ×2, one Stalker elite spawns and tracks the carrier
- **Alert 3** (5+ hot) — ×2.5, Hive Response patrol spawns, doors between you and the bench start jamming

Dropping crystals sheds alert over 20s. That's the choice: bank the run or push it.

**Decay.** Raw Voidglass destabilises 240s after extraction — it dims, then shatters. Containment Cells (craftable, hold 2 each, upgradeable to 4) freeze the timer. This stops hoarding and forces repeat runs without any PvP theft.

**Conversion.** Bench converts 1 raw crystal → 1 rifle charge in 8s. Rifle capacity 3 (upgradeable 4, 5).

**Boss cost.** Minimum 1 charge per boss if you hit every vulnerability window. Realistically 2–3. A failed attempt burns charges but not crystals in the cell — so a wipe costs a run, not the campaign.

---

## 6. Bosses — One Shared State Machine

All three bosses run the same FSM. Only data differs. This is the single biggest build-cost saving in the project.

```
DORMANT → AGGRESSIVE ⇄ ARMORED → VENT (6s) → [charged hit?]
                                    │            │
                                    │ no         │ yes
                                    ▼            ▼
                              back to AGGRESSIVE  STAGGER (4s, free damage)
                              (armor tier holds)  → armor tier −1
                                                  → 0 tiers = DEATH
```

Three armour tiers = three successful VENT punishes. Miss a window and the fight resets to AGGRESSIVE with tier intact — you lose time, not progress.

**Encounter timer.** Each arena drains breathable atmosphere over 240s. At zero the arena floods with hive and you must flee; boss resets fully. This is your "time-based boss" — a per-encounter clock, not a world clock, because a campaign that persists across days can't punish players for putting the game down.

| Boss | Sector | Movement | Signature | VENT tell | Adds |
|------|--------|----------|-----------|-----------|------|
| **BROODMOTHER** | Reactor | Stationary, centre | Continuous add spawn | Dorsal sacs glow amber | Skitters, constant |
| **THE COUPLER** | Drive Bay | Fast linear charges | Charge attack down lanes | Overheats after hitting a pillar | Bloaters, on charge |
| **CHORUS** | Bridge | Splits into 3 bodies | Bodies fire in sequence | Only when all 3 converge | Clingers, from ceiling |

Difficulty curve by design: Boss 1 teaches the loop, Boss 2 teaches environmental baiting, Boss 3 tests positioning under pressure.

---

## 7. Combat & Enemies

**Weapons**
- **Sidearm** — infinite ammo, low damage, the default verb
- **Cutting torch** — melee, doubles as the repair tool (one tool, two uses, less UI)
- **Charge Rifle** — crystal-gated, boss-only in practice, heavy wind-up

**Small aliens**
- **Skitter** — fast, weak, swarms, floor-level
- **Clinger** — ceiling ambush, drops on the player, punishes sprinting
- **Bloater** — slow, explodes, area denial
- **Stalker** (elite, alert-spawned) — hunts the crystal carrier specifically

---

## 8. Co-op

- 1–4 players. **Design and tune solo-first** — most mobile sessions will be solo, and a game that needs a friend is dead on arrival.
- **Host-authoritative WebRTC**, KV relay fallback (the Renegade Front pattern, not SALTBONE's KV polling — co-op-only netcode is far simpler than PvEvP and should use the simpler path).
- **State ownership:** host owns ship/repair/power state. Each player owns their own loadout, rifle charges, and upgrades — so you can join any friend's ship without losing your own progression.
- **Downed-and-revive**, 45s bleedout. Team wipe respawns at Cryobay: alert resets, hot crystals lost, repair progress kept.
- **Scaling:** enemy count ×1.0 / 1.6 / 2.1 / 2.5 for 1–4 players. Boss HP scales the same. **VENT windows never shrink** — co-op should raise throughput pressure, not tighten execution windows.

---

## 9. Persistence

Reuse the Flint & Fire share-code system directly.

- **Per-player (portable):** rifle charge capacity, rifle damage tier, suit O2 capacity, EVA timer, containment cell capacity
- **Per-ship (host):** repair node states, power tier, crystal node depletion, boss defeat flags
- Share code encodes ship state; player state persists locally and travels with the player

---

## 10. Rendering & Performance

- **Authored per-room PVS.** Each room declares `visibleFrom: [roomIds]`. Fixed map means near-perfect occlusion culling at zero runtime cost — an advantage interiors have over procedural terrain, and it should be exploited from build 1, not retrofitted.
- **Cel shading in enclosed space** flattens badly. Compensate with strong rim lighting, coloured practical emissives per sector (reactor = amber, medbay = cyan, hull = cold blue), and silhouette-first creature design.
- Targets: 60fps mobile, 72fps Quest 3.
- Budget: ≤ 8 rooms drawn at once, ≤ 40k tris visible, ≤ 12 dynamic lights (baked where possible).

---

## 11. Controls

**Mobile** — twin-stick, auto-fire toggle, single context button for interact/repair, charge rifle on a dedicated held button (charge-and-release).
**VR** — snap turn default with smooth as an option, teleport as a comfort fallback. Charge rifle uses two-hand grip; this is the single best VR moment in the design and worth building around.

---

## 12. Replayability — the known weak point

A fixed map with fixed nodes is one playthrough and done. Mitigation, in priority order:

1. **Randomised crystal node placement** per campaign — cheap, immediate.
2. **Randomised infestation density** per sector — cheap, changes route planning.
3. **COLD RUN (new game+)** — keeps upgrades, randomises node placement and infestation, adds boss modifiers (extra armour tier, shorter VENT, roaming between arenas) and a global campaign timer.

Ship 1 and 2 in the base build. 3 is a post-launch layer.

---

## 13. Vertical Slice — build this first

**Scope:** Cryobay + Spinal Corridor + Hydroponics + Reactor Core. Nodes N0, N1, N2. Crystal Zone A. Charge rifle at 3 charges. Boss 1 (BROODMOTHER). **Solo only, no netcode.**

Everything in the slice is a system that the full game reuses. Nothing in it is throwaway.

**Headless test harness must validate:**
1. PVS culling — correct room set drawn from every room
2. Node dependency gating — no node completable out of order
3. Power tier propagation — doors and lights respond to tier changes
4. Crystal decay timer — 240s, cell freeze, shatter on expiry
5. Aggro escalation — all four alert levels trigger at correct thresholds, shed correctly on drop
6. Boss FSM — every state transition, including missed-VENT reset and timer flee
7. O2 drain — pre-N1 global drain, arena drain, EVA suit timer
8. Save/resume round-trip — encode, decode, state identical

**Deferred to post-slice:** co-op netcode, Bosses 2–3, sectors 5–8, VR input, audio, Cold Run.

---

## 14. Open Questions

- Does the pre-N1 global O2 drain make the opening 15 minutes tense or annoying? Needs playtesting; be ready to cut it to Hydroponics-only.
- Is 240s the right crystal decay window? Depends entirely on traversal time once the map exists.
- Should the sidearm have ammo? Infinite is friendlier on mobile but removes a crafting sink.
