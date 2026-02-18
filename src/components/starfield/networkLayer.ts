export interface ConstellationNode {
  x: number;
  y: number;
  renderX: number;
  renderY: number;
  radius: number;
  baseOpacity: number;
  heartbeatPhase: number;
  driftPhase: number;
  driftX: number;
  driftY: number;
  velocityX: number;
  velocityY: number;
  status: "healthy" | "degraded" | "recovering" | "offline";
  statusTimer: number;
  livenessPending: boolean;
  livenessCursor: number;
}

export interface ConstellationEdge {
  from: number;
  to: number;
  phase: number;
}

export interface ConstellationPacket {
  path: number[];
  source: number;
  destination: number;
  kind: "app" | "ack" | "controlPing" | "controlPong" | "liveness";
  segment: number;
  progress: number;
  speed: number;
  rerouted: boolean;
  correlationKey?: string;
}

export interface PendingMessage {
  source: "A" | "B";
  queuedNode: number;
  targetNode: number;
  deadline: number;
}

export type NetworkPhase = "discovering" | "ramping" | "downing" | "recovering" | "stable";

export interface ConstellationState {
  nodes: ConstellationNode[];
  edges: ConstellationEdge[];
  adjacency: number[][];
  routingTables: number[][];
  routingVersions: number[];
  routingSharedVersions: number[][];
  neighborCursor: number[];
  endpoint: {
    senderNode: number;
    receiverNode: number;
    senderPulse: number;
    receiverPulse: number;
    senderFailPulse: number;
    receiverFailPulse: number;
    messageTimer: number;
    pendingMessages: PendingMessage[];
  };
  health: {
    pendingPongs: Record<string, number>;
    missedPongs: Record<string, number>;
    probeTimer: number;
    routingShareTimer: number;
    recoveryQueue: number[];
  };
  sync: {
    needsSync: boolean;
    quietMs: number;
    topologyVersion: number;
    syncedTopologyVersion: number;
  };
  nodeOrder: number[];
  packets: ConstellationPacket[];
  edgeActivity: Record<string, number>;
  edgeVisibility: Record<string, number>;
  nodeActivity: Record<number, number>;
  discoveredEdges: Record<string, boolean>;
  connectedNodes: Record<number, boolean>;
  phase: NetworkPhase;
  phaseElapsed: number;
  discoveryEdgeCursor: number;
  packetCadenceMs: number;
  visibilityBoost: number;
  edgeMinActivity: number;
  worldWidth: number;
  worldHeight: number;
  safePad: number;
  elapsed: number;
  eventTimer: number;
  packetTimer: number;
}

export interface NetworkTickConfig {
  reducedMotion: boolean;
  maxVisibleDiscoveryEdges: number;
  edgeFadeInRate: number;
  edgeFadeOutRate: number;
  networkSpeedMultiplier: number;
  packetSpeedMultiplier: number;
}

export const getEdgeKey = (a: number, b: number) => (a < b ? `${a}-${b}` : `${b}-${a}`);

export const directedEdgeKey = (from: number, to: number) => `${from}>${to}`;

export const removeDirectAdjacency = (
  adjacency: number[][],
  edges: Array<{ from: number; to: number; phase: number }>,
  senderNode: number,
  receiverNode: number,
) => {
  if (senderNode === receiverNode) return;
  if (adjacency[senderNode]) {
    adjacency[senderNode] = adjacency[senderNode].filter((n) => n !== receiverNode);
  }
  if (adjacency[receiverNode]) {
    adjacency[receiverNode] = adjacency[receiverNode].filter((n) => n !== senderNode);
  }
  for (let i = edges.length - 1; i >= 0; i -= 1) {
    const edge = edges[i];
    if (
      (edge.from === senderNode && edge.to === receiverNode) ||
      (edge.from === receiverNode && edge.to === senderNode)
    ) {
      edges.splice(i, 1);
    }
  }
};

const mergeRoutingInfo = (
  from: number,
  to: number,
  routingTables: number[][],
) => {
  let updates = 0;
  const fromTable = routingTables[from];
  const toTable = routingTables[to];
  for (let target = 0; target < fromTable.length; target += 1) {
    if (target === to) continue;
    if (fromTable[target] === -1) continue;
    if (toTable[target] !== -1) continue;
    toTable[target] = from;
    updates += 1;
  }
  return updates;
};

export const shareRoutingTableIfUpdated = (
  c: ConstellationState,
  from: number,
  to: number,
) => {
  const sharedVersions = c.routingSharedVersions[from];
  if (!sharedVersions || from === to) return 0;

  const sourceVersion = c.routingVersions[from] ?? 0;
  const lastSharedVersion = sharedVersions[to] ?? 0;
  if (sourceVersion <= lastSharedVersion) {
    return 0;
  }

  const updates = mergeRoutingInfo(from, to, c.routingTables);
  sharedVersions[to] = sourceVersion;

  if (updates > 0) {
    c.routingVersions[to] = (c.routingVersions[to] ?? 0) + 1;
    c.sync.needsSync = true;
    c.sync.quietMs = 0;
  }

  return updates;
};

export const routingConverged = (routingTables: number[][]) =>
  routingTables.every((row) => row.every((entry) => entry !== -1));

export const findPath = (
  adjacency: number[][],
  nodes: ConstellationNode[],
  start: number,
  end: number,
): number[] | null => {
  if (start === end) return [start];
  const queue: number[] = [start];
  const visited = new Set<number>([start]);
  const prev = new Map<number, number>();

  while (queue.length) {
    const current = queue.shift()!;
    const neighbors = adjacency[current] || [];
    for (let i = 0; i < neighbors.length; i += 1) {
      const next = neighbors[i];
      if (visited.has(next)) continue;
      if (nodes[next].status !== "healthy") continue;
      visited.add(next);
      prev.set(next, current);
      if (next === end) {
        const path: number[] = [end];
        let at = end;
        while (prev.has(at)) {
          at = prev.get(at)!;
          path.unshift(at);
          if (at === start) break;
        }
        return path;
      }
      queue.push(next);
    }
  }

  return null;
};

export const learnRouteFromPath = (
  c: ConstellationState,
  path: number[],
  destination: number,
) => {
  const updatedNodes = new Set<number>();
  for (let i = 0; i < path.length - 1; i += 1) {
    const node = path[i];
    const nextHop = path[i + 1];
    if (c.routingTables[node][destination] !== nextHop) {
      c.routingTables[node][destination] = nextHop;
      updatedNodes.add(node);
    }
  }
  if (c.routingTables[destination][destination] !== destination) {
    c.routingTables[destination][destination] = destination;
    updatedNodes.add(destination);
  }

  updatedNodes.forEach((nodeIdx) => {
    c.routingVersions[nodeIdx] = (c.routingVersions[nodeIdx] ?? 0) + 1;
  });

  if (updatedNodes.size > 0) {
    c.sync.needsSync = true;
    c.sync.quietMs = 0;
  }
};

export const broadcastLiveness = (c: ConstellationState, nodeIdx: number) => {
  const peers = (c.adjacency[nodeIdx] ?? []).filter(
    (peerIdx) => c.nodes[peerIdx]?.status === "healthy",
  );
  peers.forEach((peerIdx) => {
    c.packets.push({
      path: [nodeIdx, peerIdx],
      source: nodeIdx,
      destination: peerIdx,
      kind: "liveness",
      segment: 0,
      progress: 0,
      speed: 0.00014,
      rerouted: false,
      correlationKey: directedEdgeKey(nodeIdx, peerIdx),
    });

    shareRoutingTableIfUpdated(c, nodeIdx, peerIdx);
    shareRoutingTableIfUpdated(c, peerIdx, nodeIdx);
    c.connectedNodes[nodeIdx] = true;
    c.connectedNodes[peerIdx] = true;
    c.nodeActivity[nodeIdx] = Math.max(c.nodeActivity[nodeIdx] ?? 0, 1);
    c.nodeActivity[peerIdx] = Math.max(c.nodeActivity[peerIdx] ?? 0, 1);
  });
};

const markDeliveryFailure = (
  c: ConstellationState,
  source: number,
  destination: number,
) => {
  if (source === c.endpoint.senderNode || destination === c.endpoint.senderNode) {
    c.endpoint.senderFailPulse = 1;
  }
  if (source === c.endpoint.receiverNode || destination === c.endpoint.receiverNode) {
    c.endpoint.receiverFailPulse = 1;
  }
};

const maybeSendPendingMessage = (c: ConstellationState, nowMs: number) => {
  let cursor = 0;
  while (cursor < c.endpoint.pendingMessages.length) {
    const pending = c.endpoint.pendingMessages[cursor];
    if (nowMs >= pending.deadline) {
      if (pending.source === "A") c.endpoint.senderPulse = 1;
      if (pending.source === "B") c.endpoint.receiverPulse = 1;
      if (pending.source === "A") c.endpoint.senderFailPulse = 1;
      if (pending.source === "B") c.endpoint.receiverFailPulse = 1;
      c.endpoint.pendingMessages.splice(cursor, 1);
      continue;
    }

    const route = findPath(c.adjacency, c.nodes, pending.queuedNode, pending.targetNode);
    if (!route || route.length <= 1) {
      cursor += 1;
      continue;
    }

    c.packets.push({
      path: route,
      source: pending.queuedNode,
      destination: pending.targetNode,
      kind: "app",
      segment: 0,
      progress: 0,
      speed: 0.00011,
      rerouted: false,
      correlationKey: "",
    });

    c.endpoint.pendingMessages.splice(cursor, 1);
  }
};

export const tickNetworkReliability = (
  c: ConstellationState,
  deltaTime: number,
  config: NetworkTickConfig,
) => {
  c.elapsed += deltaTime;
  c.phaseElapsed += deltaTime;

  if (config.reducedMotion) {
    c.packets = [];
    return;
  }

  c.eventTimer += deltaTime;

  const hasLivenessInFlight = c.packets.some((packet) => packet.kind === "liveness");
  if (!hasLivenessInFlight && c.health.recoveryQueue.length > 0) {
    const recoveringIdx = c.health.recoveryQueue[0];
    const node = c.nodes[recoveringIdx];
    if (!node || node.status !== "recovering" || !node.livenessPending) {
      c.health.recoveryQueue.shift();
    } else {
      const peers = (c.adjacency[recoveringIdx] ?? []).filter(
        (peerIdx) => c.nodes[peerIdx]?.status === "healthy",
      );
      if (peers.length === 0) {
        node.livenessPending = false;
        node.status = "healthy";
        c.health.recoveryQueue.shift();
      } else {
        const cursor = node.livenessCursor % peers.length;
        const target = peers[cursor];
        c.packets.push({
          path: [recoveringIdx, target],
          source: recoveringIdx,
          destination: target,
          kind: "liveness",
          segment: 0,
          progress: 0,
          speed: 0.00012,
          rerouted: false,
          correlationKey: directedEdgeKey(recoveringIdx, target),
        });
        node.livenessCursor += 1;
        if (node.livenessCursor >= peers.length) {
          node.livenessPending = false;
          node.status = "healthy";
          c.health.recoveryQueue.shift();
        }
      }
    }
  }

  Object.keys(c.health.pendingPongs).forEach((key) => {
    c.health.pendingPongs[key] -= deltaTime;
    if (c.health.pendingPongs[key] > 0) return;
    delete c.health.pendingPongs[key];
    c.health.missedPongs[key] = (c.health.missedPongs[key] ?? 0) + 1;

    const [fromRaw, toRaw] = key.split(">");
    const from = Number(fromRaw);
    const to = Number(toRaw);
    if (Number.isNaN(from) || Number.isNaN(to)) return;

    shareRoutingTableIfUpdated(c, from, to);
    shareRoutingTableIfUpdated(c, to, from);
    const edgeKey = getEdgeKey(from, to);
    c.edgeActivity[edgeKey] = 1;
    c.nodeActivity[from] = Math.max(c.nodeActivity[from] ?? 0, 1);
    c.nodeActivity[to] = Math.max(c.nodeActivity[to] ?? 0, 1);
  });

  switch (c.phase) {
    case "discovering": {
      c.packetCadenceMs = 420;
      c.packetTimer = 0;
      c.eventTimer += deltaTime;
      if (c.eventTimer > 130) {
        c.eventTimer = 0;
        const activeExchanges = Math.min(
          config.maxVisibleDiscoveryEdges,
          c.nodes.length,
        );
        const sweepStart = c.discoveryEdgeCursor % Math.max(c.nodes.length, 1);
        c.discoveryEdgeCursor += activeExchanges;

        for (let step = 0; step < activeExchanges; step += 1) {
          const source = (sweepStart + step) % c.nodes.length;
          const neighbors = c.adjacency[source];
          if (!neighbors || neighbors.length === 0) continue;
          const cursor = c.neighborCursor[source] % neighbors.length;
          const neighbor = neighbors[cursor];
          c.neighborCursor[source] = (c.neighborCursor[source] + 1) % neighbors.length;

          shareRoutingTableIfUpdated(c, source, neighbor);
          shareRoutingTableIfUpdated(c, neighbor, source);

          const key = getEdgeKey(source, neighbor);
          c.edgeActivity[key] = 1;
          c.nodeActivity[source] = Math.max(c.nodeActivity[source] ?? 0, 1);
          c.nodeActivity[neighbor] = Math.max(c.nodeActivity[neighbor] ?? 0, 1);
        }
      }

      if (c.phaseElapsed >= 3000) {
        c.phase = "ramping";
        c.phaseElapsed = 0;
        c.packetTimer = 0;
        c.packets = [];
      }
      break;
    }

    case "ramping": {
      maybeSendPendingMessage(c, c.elapsed);
      if (c.phaseElapsed >= 1400) {
        c.phase = "stable";
        c.phaseElapsed = 0;
        c.packetTimer = 0;
      }
      break;
    }

    case "stable": {
      c.packetCadenceMs = 280;
      maybeSendPendingMessage(c, c.elapsed);

      const isControlPlaneActive = c.packets.some(
        (packet) =>
          packet.kind === "controlPing" ||
          packet.kind === "controlPong" ||
          packet.kind === "liveness",
      );

      if (!c.sync.needsSync && c.sync.syncedTopologyVersion !== c.sync.topologyVersion) {
        c.sync.needsSync = true;
        c.sync.quietMs = 0;
      }

      if (c.sync.needsSync) {
        c.health.probeTimer += deltaTime;
        c.health.routingShareTimer += deltaTime;
      }

      if (c.sync.needsSync && c.health.routingShareTimer > 760) {
        c.health.routingShareTimer = 0;
        const healthyNodes = c.nodes
          .map((node, idx) => ({ node, idx }))
          .filter(({ node }) => node.status === "healthy")
          .map(({ idx }) => idx);

        if (healthyNodes.length > 1) {
          const source = healthyNodes[Math.floor(Math.random() * healthyNodes.length)];
          const neighbors = (c.adjacency[source] ?? []).filter(
            (neighbor) => c.nodes[neighbor]?.status === "healthy",
          );
          if (neighbors.length > 0) {
            const target = neighbors[Math.floor(Math.random() * neighbors.length)];

            shareRoutingTableIfUpdated(c, source, target);
            shareRoutingTableIfUpdated(c, target, source);

            const edgeKey = getEdgeKey(source, target);
            c.discoveredEdges[edgeKey] = true;
            c.edgeActivity[edgeKey] = 1;
            c.connectedNodes[source] = true;
            c.connectedNodes[target] = true;
            c.nodeActivity[source] = Math.max(c.nodeActivity[source] ?? 0, 1);
            c.nodeActivity[target] = Math.max(c.nodeActivity[target] ?? 0, 1);

            if ((c.routingVersions[source] ?? 0) > (c.routingSharedVersions[source]?.[target] ?? 0)) {
              c.packets.push({
                path: [source, target],
                source,
                destination: target,
                kind: "liveness",
                segment: 0,
                progress: 0,
                speed: 0.00012,
                rerouted: false,
                correlationKey: directedEdgeKey(source, target),
              });
            }
          }
        }
      }

      if (c.sync.needsSync && c.health.probeTimer > 920) {
        c.health.probeTimer = 0;
        const hasControlInFlight = c.packets.some(
          (packet) =>
            packet.kind === "controlPing" ||
            packet.kind === "controlPong" ||
            packet.kind === "liveness",
        );
        if (hasControlInFlight) break;
        const source = Math.floor(Math.random() * c.nodes.length);
        const neighbors = c.adjacency[source] ?? [];
        if (neighbors.length > 0 && c.nodes[source].status === "healthy") {
          const target = neighbors[Math.floor(Math.random() * neighbors.length)];
          if (c.nodes[target].status === "healthy") {
            const key = directedEdgeKey(source, target);
            if (!c.health.pendingPongs[key]) {
              c.health.pendingPongs[key] = 1200;
              c.packets.push({
                path: [source, target],
                source,
                destination: target,
                kind: "controlPing",
                segment: 0,
                progress: 0,
                speed: 0.00012,
                rerouted: false,
                correlationKey: key,
              });
            }
          }
        }
      }

      if (c.sync.needsSync) {
        const converged = routingConverged(c.routingTables);
        if (converged && !isControlPlaneActive && c.endpoint.pendingMessages.length === 0) {
          c.sync.quietMs += deltaTime;
          if (c.sync.quietMs > 1200) {
            c.sync.needsSync = false;
            c.sync.syncedTopologyVersion = c.sync.topologyVersion;
            c.health.probeTimer = 0;
            c.health.routingShareTimer = 0;
            c.health.pendingPongs = {};
            c.health.missedPongs = {};
          }
        } else {
          c.sync.quietMs = 0;
        }
      }

      break;
    }

    case "downing":
    case "recovering": {
      c.phase = "stable";
      c.phaseElapsed = 0;
      break;
    }
  }

  c.nodes.forEach((node) => {
    node.heartbeatPhase += deltaTime * 0.00032 * config.networkSpeedMultiplier;
  });
  c.endpoint.senderPulse *= Math.exp(-deltaTime * 0.01);
  c.endpoint.receiverPulse *= Math.exp(-deltaTime * 0.01);
  c.endpoint.senderFailPulse *= Math.exp(-deltaTime * 0.009);
  c.endpoint.receiverFailPulse *= Math.exp(-deltaTime * 0.009);

  const nextPackets: ConstellationPacket[] = [];
  const nextNodeActivity: Record<number, number> = {};
  const nodeDecay = Math.exp(-deltaTime * 0.009);
  Object.entries(c.nodeActivity).forEach(([key, value]) => {
    const idx = Number(key);
    const damped = value * nodeDecay;
    if (damped > 0.05) nextNodeActivity[idx] = damped;
  });

  c.packets.forEach((packet) => {
    let active = packet;
    const fromIdx = active.path[active.segment];
    const toIdx = active.path[active.segment + 1];
    if (toIdx === undefined) return;

    nextNodeActivity[fromIdx] = Math.max(nextNodeActivity[fromIdx] ?? 0, 0.95);
    nextNodeActivity[toIdx] = Math.max(nextNodeActivity[toIdx] ?? 0, 0.95);

    if (c.nodes[toIdx].status !== "healthy") {
      const reroute = findPath(c.adjacency, c.nodes, fromIdx, active.destination);
      if (!reroute || reroute.length <= 1) {
        markDeliveryFailure(c, active.source, active.destination);
        return;
      }
      active = { ...active, path: reroute, segment: 0, progress: 0, rerouted: true };
    }

    active.progress += deltaTime * active.speed * config.packetSpeedMultiplier;
    if (active.progress < 1) {
      nextPackets.push(active);
      return;
    }

    active.progress = 0;
    active.segment += 1;
    if (active.segment < active.path.length - 1) {
      nextPackets.push(active);
      return;
    }

    if (active.kind === "app" && c.nodes[active.destination].status === "healthy") {
      learnRouteFromPath(c, active.path, active.destination);
      if (active.destination === c.endpoint.senderNode) c.endpoint.senderPulse = 1;
      if (active.destination === c.endpoint.receiverNode) c.endpoint.receiverPulse = 1;

      const ackRoute = [...active.path].reverse();
      if (ackRoute.length > 1) {
        nextPackets.push({
          path: ackRoute,
          source: active.destination,
          destination: active.source,
          kind: "ack",
          segment: 0,
          progress: 0,
          speed: active.speed * 1.04,
          rerouted: active.rerouted,
          correlationKey: "",
        });
      }
    } else if (active.kind === "controlPing" && c.nodes[active.destination].status === "healthy") {
      learnRouteFromPath(c, active.path, active.destination);
      const pongRoute = [...active.path].reverse();
      if (pongRoute.length > 1) {
        nextPackets.push({
          path: pongRoute,
          source: active.destination,
          destination: active.source,
          kind: "controlPong",
          segment: 0,
          progress: 0,
          speed: active.speed,
          rerouted: active.rerouted,
          correlationKey: active.correlationKey,
        });
      }
    } else if (active.kind === "liveness" && c.nodes[active.destination].status === "healthy") {
      shareRoutingTableIfUpdated(c, active.source, active.destination);
      shareRoutingTableIfUpdated(c, active.destination, active.source);
      const edgeKey = getEdgeKey(active.source, active.destination);
      c.edgeActivity[edgeKey] = Math.max(c.edgeActivity[edgeKey] ?? 0, 1);
      c.nodeActivity[active.source] = Math.max(c.nodeActivity[active.source] ?? 0, 1);
      c.nodeActivity[active.destination] = Math.max(c.nodeActivity[active.destination] ?? 0, 1);
    } else if (active.kind === "controlPong" && active.correlationKey) {
      learnRouteFromPath(c, active.path, active.destination);
      delete c.health.pendingPongs[active.correlationKey];
      c.health.missedPongs[active.correlationKey] = 0;
      c.nodeActivity[active.destination] = Math.max(c.nodeActivity[active.destination] ?? 0, 0.85);
      const from = active.source;
      const to = active.destination;
      const key = getEdgeKey(from, to);
      c.discoveredEdges[key] = true;
      c.connectedNodes[from] = true;
      c.connectedNodes[to] = true;
    } else if (active.kind === "ack") {
      learnRouteFromPath(c, active.path, active.destination);
      if (active.destination === c.endpoint.senderNode) {
        c.endpoint.senderPulse = Math.max(c.endpoint.senderPulse, 0.7);
      }
      if (active.destination === c.endpoint.receiverNode) {
        c.endpoint.receiverPulse = Math.max(c.endpoint.receiverPulse, 0.7);
      }
      c.nodeActivity[active.destination] = Math.max(c.nodeActivity[active.destination] ?? 0, 0.9);
    }
  });

  c.packets = nextPackets.slice(-64);
  c.nodeActivity = nextNodeActivity;

  const decay = Math.exp(-deltaTime * 0.0065);
  const nextActivity: Record<string, number> = {};
  Object.entries(c.edgeActivity).forEach(([key, value]) => {
    const damped = value * decay;
    if (damped > 0.04) nextActivity[key] = damped;
  });

  if (c.phase === "discovering") {
    c.packets.forEach((packet) => {
      const fromIdx = packet.path[packet.segment];
      const toIdx = packet.path[packet.segment + 1];
      if (toIdx === undefined) return;
      const key = getEdgeKey(fromIdx, toIdx);
      const boost = packet.rerouted ? 1 : 0.85;
      nextActivity[key] = Math.max(nextActivity[key] ?? 0, boost);
    });
  }

  c.edgeActivity = nextActivity;

  const nextEdgeVisibility: Record<string, number> = {};
  c.edges.forEach((edge) => {
    const key = getEdgeKey(edge.from, edge.to);
    const currentVisibility = c.edgeVisibility[key] ?? 0;
    const edgeEnergy = c.edgeActivity[key] ?? 0;
    const visibleThreshold =
      currentVisibility > 0.02 ? c.edgeMinActivity * 0.6 : c.edgeMinActivity;
    const shouldBeVisible =
      c.phase === "discovering"
        ? edgeEnergy >= visibleThreshold
        : (c.discoveredEdges[key] ?? false) && edgeEnergy >= visibleThreshold;

    const targetVisibility = shouldBeVisible ? 1 : 0;
    const fadeRate =
      targetVisibility > currentVisibility
        ? config.edgeFadeInRate
        : config.edgeFadeOutRate;
    const blend = 1 - Math.exp(-deltaTime * fadeRate);
    const visibility =
      currentVisibility + (targetVisibility - currentVisibility) * blend;

    if (visibility > 0.01) {
      nextEdgeVisibility[key] = visibility;
    }
  });
  c.edgeVisibility = nextEdgeVisibility;
};
