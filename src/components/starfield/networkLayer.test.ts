import { describe, expect, it } from "vitest";
import {
  findPath,
  removeDirectAdjacency,
  tickNetworkReliability,
  type ConstellationState,
} from "./networkLayer";

const createState = (): ConstellationState => ({
  nodes: [
    {
      x: 0,
      y: 0,
      renderX: 0,
      renderY: 0,
      radius: 1,
      baseOpacity: 1,
      heartbeatPhase: 0,
      driftPhase: 0,
      driftX: 0,
      driftY: 0,
      velocityX: 0,
      velocityY: 0,
      status: "healthy",
      statusTimer: 0,
      livenessPending: false,
      livenessCursor: 0,
    },
    {
      x: 0,
      y: 0,
      renderX: 0,
      renderY: 0,
      radius: 1,
      baseOpacity: 1,
      heartbeatPhase: 0,
      driftPhase: 0,
      driftX: 0,
      driftY: 0,
      velocityX: 0,
      velocityY: 0,
      status: "healthy",
      statusTimer: 0,
      livenessPending: false,
      livenessCursor: 0,
    },
  ],
  edges: [{ from: 0, to: 1, phase: 0.1 }],
  adjacency: [[1], [0]],
  routingTables: [
    [0, 1],
    [0, 1],
  ],
  routingVersions: [1, 1],
  routingSharedVersions: [
    [0, 0],
    [0, 0],
  ],
  neighborCursor: [0, 0],
  endpoint: {
    senderNode: 0,
    receiverNode: 1,
    senderPulse: 0,
    receiverPulse: 0,
    senderFailPulse: 0,
    receiverFailPulse: 0,
    messageTimer: 0,
    pendingMessages: [],
  },
  health: {
    pendingPongs: {},
    missedPongs: {},
    probeTimer: 0,
    routingShareTimer: 0,
    recoveryQueue: [],
  },
  sync: {
    needsSync: true,
    quietMs: 0,
    topologyVersion: 0,
    syncedTopologyVersion: -1,
  },
  nodeOrder: [0, 1],
  packets: [
    {
      path: [0, 1],
      source: 0,
      destination: 1,
      kind: "app",
      segment: 0,
      progress: 0,
      speed: 0.0001,
      rerouted: false,
      correlationKey: "",
    },
  ],
  edgeActivity: {},
  edgeVisibility: {},
  nodeActivity: {},
  discoveredEdges: {},
  connectedNodes: { 0: true, 1: true },
  phase: "stable",
  phaseElapsed: 0,
  discoveryEdgeCursor: 0,
  packetCadenceMs: 280,
  visibilityBoost: 1,
  edgeMinActivity: 0.06,
  worldWidth: 100,
  worldHeight: 100,
  safePad: 0,
  elapsed: 0,
  eventTimer: 0,
  packetTimer: 0,
});

describe("networkLayer", () => {
  it("removeDirectAdjacency removes both adjacency directions and edge", () => {
    const adjacency = [[1], [0]];
    const edges = [{ from: 0, to: 1, phase: 0.3 }];

    removeDirectAdjacency(adjacency, edges, 0, 1);

    expect(adjacency[0]).toEqual([]);
    expect(adjacency[1]).toEqual([]);
    expect(edges).toEqual([]);
  });

  it("findPath ignores offline nodes", () => {
    const state = createState();
    state.nodes[1].status = "offline";

    const path = findPath(state.adjacency, state.nodes, 0, 1);
    expect(path).toBeNull();
  });

  it("tickNetworkReliability clears packets in reduced motion mode", () => {
    const state = createState();

    tickNetworkReliability(state, 16, {
      reducedMotion: true,
      maxVisibleDiscoveryEdges: 3,
      edgeFadeInRate: 0.012,
      edgeFadeOutRate: 0.007,
      networkSpeedMultiplier: 1,
      packetSpeedMultiplier: 1,
    });

    expect(state.packets).toEqual([]);
  });
});
