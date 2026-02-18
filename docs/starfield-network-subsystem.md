# Starfield Network Subsystem

This document describes the generalized network simulation subsystem used by the constellation mode. It explains current behavior, architecture boundaries, and the roadmap for using it to represent failure management and containment concepts.

## Purpose

The subsystem provides a reusable, simulation-oriented “network layer” that is independent from canvas drawing. It is designed to:

- model peer-to-peer topology and routing behavior,
- simulate packet flow and control-plane health checks,
- represent node/link failures and recovery dynamics,
- feed visual adapters (like `Starfield`) with state for rendering.

It is intentionally educational/storytelling-oriented, not protocol-accurate networking software.

---

## Current architecture

## Modules

- `src/components/starfield/networkLayer.ts`
  - Generalized network state types and transition logic.
  - Pure-ish helper functions that mutate a provided `ConstellationState`.
- `src/components/Starfield.tsx`
  - Visual adapter + user interaction (canvas draw, pointer/click behavior).
  - Uses network layer outputs to animate edges, packets, node status, and endpoint pulses.

## Core model

`ConstellationState` includes:

- topology: `nodes`, `edges`, `adjacency`
- routing: `routingTables`, `routingVersions`, `routingSharedVersions`
- endpoint behavior: sender/receiver nodes, pulses, pending app messages
- health/control-plane: pending pongs, missed pongs, probe timers
- discovery/sync metadata: phase, convergence/sync fields, activity maps

## Main runtime transition

`tickNetworkReliability(state, deltaMs, config)` advances one simulation step:

1. processes recovery/liveness transitions,
2. handles ping timeout effects and rediscovery pressure,
3. advances phase logic (`discovering` → `ramping` → `stable`),
4. updates control-plane sync/convergence behavior,
5. moves packets across path segments,
6. applies delivery outcomes (ack/pong/route learning/failure pulses),
7. decays/updates node and edge activity + visibility.

Key helper APIs:

- `findPath(...)`
- `removeDirectAdjacency(...)`
- `broadcastLiveness(...)`
- `getEdgeKey(...)`

---

## How Starfield uses it today

In constellation mode:

- `Starfield` owns motion interpolation and rendering concerns (node drift, line drawing, packet dots, labels).
- The network layer owns reliability semantics and event progression.
- On click, Starfield mutates high-level intent (toggle node offline/healthy, enqueue endpoint messages) and delegates network behavior to `tickNetworkReliability`.

This split is the key generalization boundary: **rendering in one place, network semantics in another**.

---

## Reliability behaviors currently represented

- Topology discovery and route table sharing.
- Liveness/control checks via ping/pong-like packets.
- Missed pong tracking and rediscovery influence.
- Packet reroute when intermediate nodes are unavailable.
- Endpoint success/failure pulses based on delivery outcomes.
- Recovery queue behavior for nodes returning to service.

---

## Future possible improvements: failure management & containment representation

Below is a practical staged plan to evolve this subsystem into a richer failure-management model.

## Phase 1 — Domain event stream (observability-first)

Add a structured event log emitted by each tick:

- `RouteLearned`, `ProbeTimeout`, `ProbeRecovered`, `MessageDelivered`, `MessageDropped`, `NodeStateChanged`.

Why:

- decouples visual style from semantic outcomes,
- enables overlays/tooltips/timelines,
- makes tests and future policy engines cleaner.

## Phase 2 — Failure domains and blast radius

Add domain tags to nodes/edges (e.g., `zone`, `rack`, `dependencyGroup`) and policies:

- correlated failure injection,
- inter-domain link degradation,
- containment boundaries.

Why:

- supports realistic “localized failure” storytelling,
- enables visualizing containment success/failure.

## Phase 3 — Explicit policy layer

Define policy config separate from state:

- retry/backoff strategy,
- probe cadence and quorum rules,
- circuit-breaker thresholds,
- recovery gates (cooldown, max parallel recoveries).

Why:

- you can compare policy profiles (“aggressive retry” vs “safe containment”) without rewriting simulation logic.

## Phase 4 — Containment playbooks

Model deterministic playbook steps as state machine actions:

- isolate node/group,
- drain traffic,
- reroute via fallback links,
- staged rejoin and validation.

Why:

- turns the subsystem into a scenario runner for incident response narratives.

## Phase 5 — SLO/error budget overlay

Track rolling metrics from events:

- success ratio,
- mean delivery latency (simulated),
- dropped message rate,
- “recovery time” per incident.

Why:

- allows higher-level reliability communication and tradeoff visualization.

---

## Recommended implementation constraints

To keep the subsystem maintainable:

1. Keep `networkLayer.ts` free from canvas/DOM concerns.
2. Prefer pure transition helpers + explicit state in/out.
3. Add deterministic test hooks (seeded RNG / injectable random source).
4. Introduce narrow policy interfaces rather than hard-coding timings.
5. Keep visual-only fields out of core reliability logic when possible.

---

## Testing strategy

Current tests:

- `src/components/starfield/networkLayer.test.ts`
  - adjacency removal,
  - path behavior with offline nodes,
  - reduced-motion packet clearing.

Next tests to add (recommended):

- probe timeout increments + recovery reset,
- reroute vs delivery failure scenarios,
- convergence transition to synced state,
- recovery queue progression,
- policy behavior snapshots (once policy layer is introduced).

