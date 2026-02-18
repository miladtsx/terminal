import { useEffect, useRef, useCallback } from "react";
import {
  broadcastLiveness as broadcastNetworkLiveness,
  getEdgeKey,
  removeDirectAdjacency as removeDirectAdjacencyFromLayer,
  tickNetworkReliability,
  type ConstellationEdge,
  type ConstellationNode,
  type ConstellationState,
} from "@components/starfield/networkLayer";

const STARFIELD_CONFIG = {
  minStars: 40,
  maxStars: 256,
  fadeInMs: 3200,
  consumeRadiusBase: 8,
  consumeRadiusScale: 1.5,
  influenceRadius: 340,
  influenceRadiusSq: 340 * 340,
  gravityAccel: 0.00042,
  gravityDampingBase: 0.975,
  qualityLevels: [
    { multiplier: 1, glow: true },
    { multiplier: 0.72, glow: true },
    { multiplier: 0.5, glow: false },
  ] as const,
  maxVisibleDiscoveryEdges: 3,
  edgeFadeInRate: 0.012,
  edgeFadeOutRate: 0.007,
} as const;

const NETWORK_SPEED_MULTIPLIER = 10.5;
const PACKET_SPEED_MULTIPLIER = 20.3;
const CONSTELLATION_VISIBILITY_MULTIPLIER = 1.3;

export const removeDirectAdjacency = (
  adjacency: number[][],
  edges: Array<{ from: number; to: number; phase: number }>,
  senderNode: number,
  receiverNode: number,
) => {
  removeDirectAdjacencyFromLayer(adjacency, edges, senderNode, receiverNode);
};

export interface StarfieldProps {
  /** Stars per 10,000 px² of viewport area */
  density?: number;
  /** Speed multiplier for drift animation */
  speed?: number;
  /** Twinkle rate (0-1, where 0 = no twinkle, 1 = frequent) */
  twinkleRate?: number;
  /** Number of depth layers (2-4 recommended) */
  layers?: number;
  /** Enable/disable starfield (useful when switching themes) */
  enabled?: boolean;
  /** Visual behavior mode */
  mode?: "ambient" | "constellation";
  /** Render crisp/high-contrast starfield (used for fullscreen playground) */
  focused?: boolean;
  /** Scales star/network element size (wired to terminal font controls) */
  visualScale?: number;
}

/**
 * Night Sky Starfield Component
 *
 * A performant canvas-based animated starfield that creates a "living" night sky
 * effect with drifting stars and subtle twinkling. Designed to work seamlessly
 * behind UI elements without affecting readability.
 *
 * @param density - Stars per 10,000 px² (default: 3 for subtle, 5 for richer)
 * @param speed - Drift speed multiplier (default: 0.3)
 * @param twinkleRate - How often stars twinkle, 0-1 (default: 0.4)
 * @param layers - Number of depth parallax layers (default: 3)
 * @param enabled - Toggle starfield rendering
 *
 * @example
 * ```tsx
 * <Starfield density={4} speed={0.3} enabled={isNightSkyTheme} />
 * ```
 */
export function Starfield({
  density = 4,
  speed = 0.3,
  twinkleRate = 0.4,
  layers = 3,
  enabled = true,
  mode = "ambient",
  focused = false,
  visualScale = 1,
}: StarfieldProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number | null>(null);
  const starsRef = useRef<Star[]>([]);
  const lastTimeRef = useRef<number>(0);
  const fadeStartRef = useRef<number | null>(null);
  const dprRef = useRef<number>(1);
  const fpsEmaRef = useRef<number>(60);
  const qualityLevelRef = useRef<0 | 1 | 2>(0);
  const qualityCooldownRef = useRef<number>(0);
  const tabActiveRef = useRef<boolean>(true);
  const suspendedUntilPointerRef = useRef<boolean>(false);
  const constellationRef = useRef<ConstellationState>({
    nodes: [],
    edges: [],
    adjacency: [],
    routingTables: [],
    routingVersions: [],
    routingSharedVersions: [],
    neighborCursor: [],
    endpoint: {
      senderNode: 0,
      receiverNode: 0,
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
    nodeOrder: [],
    packets: [],
    edgeActivity: {},
    edgeVisibility: {},
    nodeActivity: {},
    discoveredEdges: {},
    connectedNodes: {},
    phase: "discovering",
    phaseElapsed: 0,
    discoveryEdgeCursor: 0,
    packetCadenceMs: 420,
    visibilityBoost: 1,
    edgeMinActivity: 0.06,
    worldWidth: 0,
    worldHeight: 0,
    safePad: 0,
    elapsed: 0,
    eventTimer: 0,
    packetTimer: 0,
  });
  const pointerRef = useRef<{ x: number; y: number; active: boolean; influence: number }>({
    x: 0,
    y: 0,
    active: false,
    influence: 0,
  });

  const isMotionReduced = useCallback(() => {
    if (typeof window === "undefined") return true;
    return (
      window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false
    );
  }, []);

  const elementScale = Math.max(0.75, Math.min(2.4, visualScale * (focused ? 1.22 : 1)));

  const initStars = useCallback(
    (width: number, height: number) => {
      const area = width * height;
      const starCount = Math.min(
        STARFIELD_CONFIG.maxStars,
        Math.max(STARFIELD_CONFIG.minStars, Math.floor((area / 10000) * density)),
      );

      const stars: Star[] = [];
      for (let i = 0; i < starCount; i++) {
        stars.push(createStar(width, height, layers));
      }
      starsRef.current = stars;
    },
    [density, layers],
  );

  const initConstellation = useCallback((width: number, height: number) => {
    const area = width * height;
    const nodeCount = Math.max(12, Math.min(22, Math.floor(area / 90000)));
    const minDim = Math.min(width, height);
    const isMobile = minDim < 760;
    const visibilityBoost = isMobile ? 1.55 : 1;
    const safePad = Math.max(18, minDim * 0.06);
    const nodes: ConstellationNode[] = [];

    for (let i = 0; i < nodeCount; i += 1) {
      const tier = i % 3;
      const ratio = (i + 1) / (nodeCount + 1);
      const goldenAngle = 2.399963229728653;
      const angle = i * goldenAngle + tier * 0.24;
      const radius = minDim * (0.13 + 0.34 * Math.sqrt(ratio));
      const orbitX = width >= height ? 1.16 : 0.94;
      const orbitY = 0.74;
      const harmonicBend = Math.sin(ratio * Math.PI * 2) * minDim * 0.04;
      const px = width * 0.5 + Math.cos(angle) * radius * orbitX;
      const py = height * 0.5 + Math.sin(angle) * radius * orbitY + harmonicBend;
      const x = Math.max(safePad, Math.min(width - safePad, px));
      const y = Math.max(safePad, Math.min(height - safePad, py));

      nodes.push({
        x,
        y,
        renderX: x,
        renderY: y,
        radius: (1.1 + (((i * 17) % 10) / 10) * 1.2) * (isMobile ? 1.35 : 1),
        baseOpacity: Math.min(
          0.96,
          (0.62 + (((i * 31) % 10) / 10) * 0.26) * visibilityBoost,
        ),
        heartbeatPhase: ((i * 47) % 100) / 100,
        driftPhase: ((i * 19) % 100) / 100,
        driftX: 1.4 + (((i * 23) % 10) / 10) * 1.8,
        driftY: 0.8 + (((i * 37) % 10) / 10) * 1.1,
        velocityX: (Math.random() - 0.5) * 0.018,
        velocityY: (Math.random() - 0.5) * 0.018,
        status: "healthy",
        statusTimer: 0,
        livenessPending: false,
        livenessCursor: 0,
      });
    }

    const edges: ConstellationEdge[] = [];
    const pushEdge = (from: number, to: number, phaseSeed: number) => {
      if (from === to) return;
      const exists = edges.some(
        (edge) =>
          (edge.from === from && edge.to === to) ||
          (edge.from === to && edge.to === from),
      );
      if (exists) return;
      edges.push({ from, to, phase: (phaseSeed % 100) / 100 });
    };

    // Harmonic topology (PI-based): stable, deterministic, visually coherent.
    const TAU = Math.PI * 2;
    const centerX = width * 0.5;
    const centerY = height * 0.5;
    const polar = nodes
      .map((node, idx) => {
        const dx = node.x - centerX;
        const dy = node.y - centerY;
        const angle = (Math.atan2(dy, dx) + TAU) % TAU;
        const radius = Math.hypot(dx, dy);
        return { idx, angle, radius };
      })
      .sort((a, b) => a.angle - b.angle);

    // 1) Ring links by angle order: smooth perimeter structure.
    for (let i = 0; i < polar.length; i += 1) {
      const a = polar[i].idx;
      const b = polar[(i + 1) % polar.length].idx;
      pushEdge(a, b, i * 17 + 11);
    }

    // 2) Harmonic chords using PI step to create elegant long-range structure.
    const harmonicStep = Math.max(2, Math.round(nodes.length / Math.PI));
    for (let i = 0; i < polar.length; i += 1) {
      const a = polar[i].idx;
      const b = polar[(i + harmonicStep) % polar.length].idx;
      pushEdge(a, b, i * 29 + 7);
    }

    // 3) Radial spokes: connect across adjacent radius bands with angle harmony.
    const radii = polar.map((entry) => entry.radius);
    const minRadius = Math.min(...radii);
    const maxRadius = Math.max(...radii);
    const bandCount = 4;
    const radiusSpan = Math.max(maxRadius - minRadius, 1);
    const bandOf = (radius: number) =>
      Math.min(
        bandCount - 1,
        Math.floor(((radius - minRadius) / radiusSpan) * bandCount),
      );

    for (let i = 0; i < polar.length; i += 1) {
      const source = polar[i];
      const sourceBand = bandOf(source.radius);
      const targetBand = Math.min(sourceBand + 1, bandCount - 1);

      let best: { idx: number; score: number } | null = null;
      for (let j = 0; j < polar.length; j += 1) {
        if (i === j) continue;
        const candidate = polar[j];
        if (bandOf(candidate.radius) !== targetBand) continue;

        const rawDelta = Math.abs(candidate.angle - source.angle);
        const delta = Math.min(rawDelta, TAU - rawDelta);
        if (delta > Math.PI / 5) continue;

        // PI-tuned score: prefer close angle + smooth radial progression.
        const radialDelta = Math.abs(candidate.radius - source.radius) / radiusSpan;
        const score = delta / Math.PI + radialDelta * 0.35;
        if (!best || score < best.score) {
          best = { idx: candidate.idx, score };
        }
      }

      if (best) {
        pushEdge(source.idx, best.idx, i * 59 + best.idx * 13);
      }
    }

    const adjacency: number[][] = Array.from({ length: nodes.length }, () => []);
    edges.forEach((edge) => {
      adjacency[edge.from].push(edge.to);
      adjacency[edge.to].push(edge.from);
    });

    const byX = nodes
      .map((node, idx) => ({ idx, x: node.x }))
      .sort((a, b) => a.x - b.x);
    const senderNode = byX[0]?.idx ?? 0;
    const receiverNode = byX[byX.length - 1]?.idx ?? Math.max(0, nodes.length - 1);

    // Keep endpoint direct edge unknown at startup; it must be learned after first exchange.
    removeDirectAdjacency(adjacency, edges, senderNode, receiverNode);

    const routingTables = Array.from({ length: nodes.length }, (_, idx) => {
      const row = Array.from({ length: nodes.length }, () => -1);
      row[idx] = idx;
      adjacency[idx].forEach((neighbor) => {
        row[neighbor] = neighbor;
      });
      return row;
    });
    const routingVersions = Array.from({ length: nodes.length }, () => 1);
    const routingSharedVersions = Array.from({ length: nodes.length }, () =>
      Array.from({ length: nodes.length }, () => 0),
    );

    constellationRef.current = {
      nodes,
      edges,
      adjacency,
      routingTables,
      routingVersions,
      routingSharedVersions,
      neighborCursor: Array.from({ length: nodes.length }, () => 0),
      endpoint: {
        senderNode,
        receiverNode,
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
      nodeOrder: polar.map((entry) => entry.idx),
      packets: [],
      edgeActivity: {},
      edgeVisibility: {},
      nodeActivity: {},
      discoveredEdges: {},
      connectedNodes: {
        [senderNode]: true,
        [receiverNode]: true,
      },
      phase: "discovering",
      phaseElapsed: 0,
      discoveryEdgeCursor: 0,
      packetCadenceMs: isMobile ? 280 : 420,
      visibilityBoost,
      edgeMinActivity: isMobile ? 0.035 : 0.06,
      worldWidth: width,
      worldHeight: height,
      safePad,
      elapsed: 0,
      eventTimer: 0,
      packetTimer: 0,
    };
  }, []);


  const drawEndpointLabel = (
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    label: string,
    pulse: number,
    failPulse: number,
    visibility: number,
  ) => {
    const alpha = Math.min(1, 0.66 + pulse * 0.34 + failPulse * 0.24) * visibility;
    const glow = 0.35 + pulse * 0.65;
    const failGlow = 0.25 + failPulse * 0.75;
    const borderColor = failPulse > 0.08
      ? `rgba(255, 139, 139, ${0.82 * failGlow * alpha})`
      : `rgba(214, 228, 246, ${0.86 * glow * alpha})`;
    ctx.save();
    ctx.translate(x, y - 18);
    ctx.scale(elementScale, elementScale);

    ctx.beginPath();
    ctx.arc(0, 0, 16, 0, Math.PI * 2);
    ctx.fillStyle = failPulse > 0.08
      ? `rgba(255, 116, 116, ${0.22 * failGlow * alpha})`
      : `rgba(158, 220, 255, ${0.2 * glow * alpha})`;
    ctx.fill();

    ctx.beginPath();
    ctx.roundRect(-15, -10, 30, 20, 6);
    ctx.fillStyle = `rgba(10, 16, 26, ${0.95 * alpha})`;
    ctx.fill();
    ctx.lineWidth = 1.1;
    ctx.strokeStyle = borderColor;
    ctx.stroke();

    ctx.fillStyle = `rgba(240, 247, 255, ${0.96 * glow * alpha})`;
    ctx.font = "11px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(label, 0, 0);
    ctx.restore();
  };

  const createStar = (width: number, height: number, layerCount: number): Star => {
    const layer = Math.floor(Math.random() * layerCount);
    const baseScale = 0.3 + (layer / (layerCount - 1)) * 0.7;
    const layerVelocityScale = 0.45 + ((layer + 1) / Math.max(layerCount, 1)) * 0.55;

    return {
      x: Math.random() * width,
      y: Math.random() * height,
      radius: (0.5 + Math.random() * 1.2) * baseScale,
      baseOpacity: 0.3 + Math.random() * 0.5,
      twinklePhase: Math.random() * Math.PI * 2,
      twinkleSpeed: 0.5 + Math.random() * 1.5,
      velocityX: (Math.random() - 0.5) * 0.05 * layerVelocityScale,
      velocityY: (Math.random() - 0.5) * 0.035 * layerVelocityScale,
      gravityVX: 0,
      gravityVY: 0,
      layer,
      hoverBoost: 0,
      respawnDelay: 0,
      glowStrength: Math.random() > 0.8 ? 1 : 0,
      twinkleStrength: 0.1 + Math.random() * 0.08,
    };
  };

  const randomEdgePosition = (width: number, height: number) => {
    const side = Math.floor(Math.random() * 4);
    switch (side) {
      case 0:
        return { x: -8, y: Math.random() * height };
      case 1:
        return { x: width + 8, y: Math.random() * height };
      case 2:
        return { x: Math.random() * width, y: -8 };
      default:
        return { x: Math.random() * width, y: height + 8 };
    }
  };

  const respawnStar = (star: Star, width: number, height: number) => {
    const edgePos = randomEdgePosition(width, height);
    star.x = edgePos.x;
    star.y = edgePos.y;
    star.gravityVX = 0;
    star.gravityVY = 0;
    star.hoverBoost = 0;
    star.twinklePhase = Math.random() * Math.PI * 2;
  };

  const updateStar = (star: Star, deltaTime: number, width: number, height: number) => {
    if (star.respawnDelay > 0) {
      star.respawnDelay -= deltaTime;
      if (star.respawnDelay <= 0) {
        respawnStar(star, width, height);
      }
      return;
    }

    const pointer = pointerRef.current;
    const gravityInfluence = pointer.influence;

    // Persistent "black-hole" gravity that decays after pointer moves away.
    if (gravityInfluence > 0.001) {
      const gx = pointer.x - star.x;
      const gy = pointer.y - star.y;
      const distanceSq = gx * gx + gy * gy;
      const consumeRadius =
        STARFIELD_CONFIG.consumeRadiusBase +
        star.radius * STARFIELD_CONFIG.consumeRadiusScale;
      const consumeRadiusSq = consumeRadius * consumeRadius;
      if (distanceSq <= consumeRadiusSq && pointer.active) {
        star.respawnDelay = 280 + Math.random() * 620;
        star.x = pointer.x;
        star.y = pointer.y;
        star.gravityVX = 0;
        star.gravityVY = 0;
        return;
      }

      if (distanceSq < STARFIELD_CONFIG.influenceRadiusSq) {
        const distance = Math.sqrt(distanceSq) + 0.0001;
        const pull = 1 - distance / STARFIELD_CONFIG.influenceRadius;
        const accel =
          pull * pull * STARFIELD_CONFIG.gravityAccel * gravityInfluence;
        star.gravityVX += (gx / distance) * accel * deltaTime;
        star.gravityVY += (gy / distance) * accel * deltaTime;
      }
    }

    const gravityDamping = Math.pow(STARFIELD_CONFIG.gravityDampingBase, deltaTime / 16);
    star.gravityVX *= gravityDamping;
    star.gravityVY *= gravityDamping;

    const vx = star.velocityX + star.gravityVX;
    const vy = star.velocityY + star.gravityVY;

    // Update position with drift
    star.x += vx * speed * deltaTime;
    star.y += vy * speed * deltaTime;

    // Wrap around edges
    if (star.x < -star.radius) star.x = width + star.radius;
    if (star.x > width + star.radius) star.x = -star.radius;
    if (star.y < -star.radius) star.y = height + star.radius;
    if (star.y > height + star.radius) star.y = -star.radius;

    // Update twinkle phase
    star.twinklePhase += star.twinkleSpeed * deltaTime * 0.001;
  };

  const drawStars = (
    ctx: CanvasRenderingContext2D,
    stars: Star[],
    activeCount: number,
    glowEnabled: boolean,
    width: number,
    height: number,
    reducedMotion: boolean,
    twinkleFactor: number,
    visibility: number,
  ) => {
    ctx.clearRect(0, 0, width, height);

    const pointer = pointerRef.current;

    for (let i = 0; i < activeCount; i += 1) {
      const star = stars[i];
      if (star.respawnDelay > 0) continue;

      // Calculate opacity with twinkle
      let opacity = star.baseOpacity;
      const twinkleBase = reducedMotion ? 0.2 : twinkleFactor;
      const twinkle = Math.sin(star.twinklePhase) * star.twinkleStrength * twinkleBase;
      opacity = Math.max(0.1, Math.min(1, opacity + twinkle));

      if (pointer.active) {
        const dx = star.x - pointer.x;
        const dy = star.y - pointer.y;
        const hitRadius = Math.max(18, star.radius * 18);
        const hitRadiusSq = hitRadius * hitRadius;
        const distanceSq = dx * dx + dy * dy;
        if (distanceSq <= hitRadiusSq) {
          const distance = Math.sqrt(distanceSq);
          const proximity = 1 - distance / hitRadius;
          star.hoverBoost = Math.max(star.hoverBoost, proximity);
        }
      }

      // Each star reacts individually and then smoothly settles back.
      star.hoverBoost *= 0.9;
      opacity += star.hoverBoost * 0.5;

      opacity *= visibility;
      opacity = Math.max(0.05, Math.min(1, opacity));
      const drawX = star.x;
      const drawY = star.y;
      const drawRadius = star.radius * (1 + star.hoverBoost * 0.35) * elementScale;

      // Draw star
      ctx.beginPath();
      ctx.arc(drawX, drawY, drawRadius, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255, 255, 255, ${opacity})`;
      ctx.fill();

      // Add subtle glow to brighter stars
      if (glowEnabled && star.glowStrength > 0 && star.baseOpacity > 0.6 && star.radius > 0.8) {
        ctx.beginPath();
        ctx.arc(drawX, drawY, drawRadius * 2.2, 0, Math.PI * 2);
        const gradient = ctx.createRadialGradient(
          drawX,
          drawY,
          0,
          drawX,
          drawY,
          drawRadius * 2.2,
        );
        gradient.addColorStop(0, `rgba(200, 220, 255, ${opacity * 0.24})`);
        gradient.addColorStop(1, "rgba(200, 220, 255, 0)");
        ctx.fillStyle = gradient;
        ctx.fill();
      }
    }
  };

  const updateConstellation = (deltaTime: number, reducedMotion: boolean) => {
    const c = constellationRef.current;
    c.elapsed += deltaTime;
    c.phaseElapsed += deltaTime;
    const time = c.elapsed * 0.001;
    const smoothing = 1 - Math.exp(-deltaTime * 0.0085);
    const motionScale = reducedMotion ? 0 : deltaTime * 0.06;
    const minX = c.safePad;
    const maxX = Math.max(minX + 1, c.worldWidth - c.safePad);
    const minY = c.safePad;
    const maxY = Math.max(minY + 1, c.worldHeight - c.safePad);

    c.nodes.forEach((node) => {
      // Mobile-node style floating movement with gentle, bounded random walk.
      if (!reducedMotion) {
        const wanderX = Math.sin(time * 0.24 + node.driftPhase * Math.PI * 2) * 0.00055;
        const wanderY = Math.cos(time * 0.21 + node.driftPhase * Math.PI * 2) * 0.00055;
        node.velocityX += wanderX * deltaTime;
        node.velocityY += wanderY * deltaTime;

        const maxVelocity = 0.038;
        const speed = Math.hypot(node.velocityX, node.velocityY);
        if (speed > maxVelocity) {
          const ratio = maxVelocity / speed;
          node.velocityX *= ratio;
          node.velocityY *= ratio;
        }

        node.x += node.velocityX * motionScale;
        node.y += node.velocityY * motionScale;

        if (node.x < minX) {
          node.x = minX;
          node.velocityX = Math.abs(node.velocityX) * 0.94;
        } else if (node.x > maxX) {
          node.x = maxX;
          node.velocityX = -Math.abs(node.velocityX) * 0.94;
        }

        if (node.y < minY) {
          node.y = minY;
          node.velocityY = Math.abs(node.velocityY) * 0.94;
        } else if (node.y > maxY) {
          node.y = maxY;
          node.velocityY = -Math.abs(node.velocityY) * 0.94;
        }

        node.velocityX *= 0.995;
        node.velocityY *= 0.995;
      }

      const waveA = Math.sin(time * 0.26 * NETWORK_SPEED_MULTIPLIER + node.driftPhase * Math.PI * 2);
      const waveB = Math.cos(time * 0.18 * NETWORK_SPEED_MULTIPLIER + node.driftPhase * Math.PI * 2 * 1.22);
      const targetX = reducedMotion ? node.x : node.x + waveA * node.driftX;
      const targetY = reducedMotion ? node.y : node.y + waveB * node.driftY;
      node.renderX += (targetX - node.renderX) * smoothing;
      node.renderY += (targetY - node.renderY) * smoothing;
    });

    tickNetworkReliability(c, deltaTime, {
      reducedMotion,
      maxVisibleDiscoveryEdges: STARFIELD_CONFIG.maxVisibleDiscoveryEdges,
      edgeFadeInRate: STARFIELD_CONFIG.edgeFadeInRate,
      edgeFadeOutRate: STARFIELD_CONFIG.edgeFadeOutRate,
      networkSpeedMultiplier: NETWORK_SPEED_MULTIPLIER,
      packetSpeedMultiplier: PACKET_SPEED_MULTIPLIER,
    });
  };

  const drawConstellation = (
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    reducedMotion: boolean,
    visibility: number,
  ) => {
    ctx.clearRect(0, 0, width, height);
    const c = constellationRef.current;
    const points = c.nodes.map((node) => ({ x: node.renderX, y: node.renderY }));

    const activeEdges = c.edges
      .map((edge) => ({
        edge,
        energy: c.edgeActivity[getEdgeKey(edge.from, edge.to)] ?? 0,
        visibility: c.edgeVisibility[getEdgeKey(edge.from, edge.to)] ?? 0,
      }))
      .filter(({ visibility }) => visibility > 0.02)
      .sort((a, b) => b.visibility * b.energy - a.visibility * a.energy)
      .slice(0, STARFIELD_CONFIG.maxVisibleDiscoveryEdges);

    activeEdges.forEach(({ edge, energy: edgeEnergy, visibility: edgeVisibility }) => {
      const from = c.nodes[edge.from];
      const to = c.nodes[edge.to];
      if (!from || !to) return;
      const fromP = points[edge.from];
      const toP = points[edge.to];
      const degraded = from.status === "degraded" || to.status === "degraded";
      const pulse = reducedMotion
        ? 0.62
        : 0.56 + 0.2 * (0.5 + 0.5 * Math.sin(c.elapsed * 0.0013 + edge.phase * Math.PI * 2));
      const energyMix = 0.35 + Math.min(1, edgeEnergy) * 0.65;
      const alpha = Math.min(
        1,
        (degraded ? 0.28 : pulse)
          * energyMix
          * edgeVisibility
          * visibility
          * c.visibilityBoost
          * CONSTELLATION_VISIBILITY_MULTIPLIER,
      );
      ctx.beginPath();
      ctx.moveTo(fromP.x, fromP.y);
      ctx.lineTo(toP.x, toP.y);
      ctx.strokeStyle = `rgba(157, 195, 255, ${alpha})`;
      ctx.lineWidth =
        (0.32 + energyMix * 0.26) * (0.84 + c.visibilityBoost * 0.12) * (0.72 + edgeVisibility * 0.28) * elementScale;
      ctx.stroke();

      // Subtle traveling packet across dependency edges to avoid static feel.
    });

    if (!reducedMotion) {
      c.packets.forEach((packet) => {
        const from = points[packet.path[packet.segment]];
        const to = points[packet.path[packet.segment + 1]];
        if (!from || !to) return;
        const px = from.x + (to.x - from.x) * packet.progress;
        const py = from.y + (to.y - from.y) * packet.progress;
        ctx.beginPath();
        ctx.arc(px, py, 1.25 * (0.9 + c.visibilityBoost * 0.16) * elementScale, 0, Math.PI * 2);
        ctx.fillStyle = packet.kind === "ack"
          ? `rgba(255, 204, 143, ${Math.min(1, 0.74 * visibility * c.visibilityBoost * CONSTELLATION_VISIBILITY_MULTIPLIER)})`
          : packet.kind === "app"
            ? `rgba(255, 120, 235, ${Math.min(1, 0.82 * visibility * c.visibilityBoost * CONSTELLATION_VISIBILITY_MULTIPLIER)})`
          : packet.kind === "controlPing" || packet.kind === "controlPong"
            ? `rgba(174, 181, 193, ${Math.min(1, 0.54 * visibility * c.visibilityBoost * CONSTELLATION_VISIBILITY_MULTIPLIER)})`
          : packet.kind === "liveness"
            ? `rgba(159, 255, 184, ${Math.min(1, 0.64 * visibility * c.visibilityBoost * CONSTELLATION_VISIBILITY_MULTIPLIER)})`
          : packet.rerouted
            ? `rgba(255, 213, 128, ${Math.min(1, 0.66 * visibility * c.visibilityBoost * CONSTELLATION_VISIBILITY_MULTIPLIER)})`
            : `rgba(186, 225, 255, ${Math.min(1, 0.44 * visibility * c.visibilityBoost * CONSTELLATION_VISIBILITY_MULTIPLIER)})`;
        ctx.fill();
      });
    }

    c.nodes.forEach((node, idx) => {
      const p = points[idx];
      const reveal = c.phase === "discovering"
        ? Math.max(0.12, Math.min(1, (c.phaseElapsed - idx * 55) / 820))
        : 1;
      const heartbeat = reducedMotion
        ? 0
        : 0.08 * (0.5 + 0.5 * Math.sin(node.heartbeatPhase * Math.PI * 2));
      const statusBoost =
        node.status === "offline"
          ? -0.22
          : node.status === "degraded" || node.status === "recovering"
            ? -0.1
            : 0;
      const ioEnergy = c.nodeActivity[idx] ?? 0;
      const ioBlink = 0.6 + 0.4 * Math.sin(c.elapsed * 0.012 + idx * 0.5);
      const isQueued = c.endpoint.pendingMessages.some((pending) => pending.queuedNode === idx);
      const isConnected = c.connectedNodes[idx] ?? false;
      const isCommunicating = ioEnergy > 0.08 && node.status === "healthy";
      const standbyColor = "164, 173, 186";
      const ioColor = "158, 255, 196";
      const downColor = "234, 84, 84";
      const queuedColor = "255, 213, 102";
      const opacity = Math.max(
        0.12,
        Math.min(
          1,
          ((0.14 + Math.min(ioEnergy, 1) * 0.68) + heartbeat + statusBoost + (isCommunicating ? 0.16 * ioBlink : 0))
            * visibility
            * c.visibilityBoost
            * CONSTELLATION_VISIBILITY_MULTIPLIER
            * reveal,
        ),
      );
      const color = node.status === "offline"
        ? standbyColor
        : node.status === "degraded" || node.status === "recovering"
          ? downColor
        : isQueued
          ? queuedColor
          : isConnected || isCommunicating
            ? ioColor
            : standbyColor;

      ctx.beginPath();
      ctx.arc(
        p.x,
        p.y,
        (node.radius + (node.status === "recovering" ? 0.25 : 0)) * elementScale,
        0,
        Math.PI * 2,
      );
      ctx.fillStyle = `rgba(${color}, ${opacity})`;
      ctx.fill();

      // no extra glow ring: keep strict state colors only
    });

    const senderNode = c.nodes[c.endpoint.senderNode];
    const receiverNode = c.nodes[c.endpoint.receiverNode];
    if (senderNode && receiverNode) {
      drawEndpointLabel(
        ctx,
        senderNode.renderX,
        senderNode.renderY,
        "A",
        c.endpoint.senderPulse,
        c.endpoint.senderFailPulse,
        visibility,
      );
      drawEndpointLabel(
        ctx,
        receiverNode.renderX,
        receiverNode.renderY,
        "B",
        c.endpoint.receiverPulse,
        c.endpoint.receiverFailPulse,
        visibility,
      );
    }
  };

  const animate = useCallback(
    (time: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const width = canvas.width;
      const height = canvas.height;
      const rawDeltaTime = time - lastTimeRef.current;
      const deltaTime = Math.min(rawDeltaTime, 34);
      lastTimeRef.current = time;

      const fps = 1000 / Math.max(deltaTime, 1);
      fpsEmaRef.current = fpsEmaRef.current * 0.92 + fps * 0.08;
      qualityCooldownRef.current = Math.max(0, qualityCooldownRef.current - deltaTime);
      if (qualityCooldownRef.current === 0) {
        if (fpsEmaRef.current < 42 && qualityLevelRef.current < 2) {
          qualityLevelRef.current = (qualityLevelRef.current + 1) as 0 | 1 | 2;
          qualityCooldownRef.current = 1400;
        } else if (fpsEmaRef.current > 56 && qualityLevelRef.current > 0) {
          qualityLevelRef.current = (qualityLevelRef.current - 1) as 0 | 1 | 2;
          qualityCooldownRef.current = 1800;
        }
      }

      const reducedMotion = isMotionReduced();
      // Keep black-hole strength constant while cursor is active.
      if (pointerRef.current.active) {
        pointerRef.current.influence = 1;
      } else {
        pointerRef.current.influence = 0;
      }
      const elapsed = fadeStartRef.current === null ? 0 : time - fadeStartRef.current;
      const fadeProgress = Math.min(
        Math.max(elapsed / STARFIELD_CONFIG.fadeInMs, 0),
        1,
      );
      const visibility = 1 - Math.pow(1 - fadeProgress, 2);
      const widthCss = width / dprRef.current;
      const heightCss = height / dprRef.current;

      if (mode === "constellation") {
        updateConstellation(deltaTime, reducedMotion);
        drawConstellation(ctx, widthCss, heightCss, reducedMotion, visibility);
      } else {
        const quality = STARFIELD_CONFIG.qualityLevels[qualityLevelRef.current];
        const twinkleFactor = 0.35 + Math.max(0, Math.min(1, twinkleRate)) * 0.65;
        const activeCount = Math.max(
          STARFIELD_CONFIG.minStars,
          Math.min(starsRef.current.length, Math.floor(starsRef.current.length * quality.multiplier)),
        );

        for (let i = 0; i < activeCount; i += 1) {
          const star = starsRef.current[i];
          if (!reducedMotion) {
            updateStar(star, deltaTime, widthCss, heightCss);
          }
        }

        drawStars(
          ctx,
          starsRef.current,
          activeCount,
          quality.glow,
          width,
          height,
          reducedMotion,
          twinkleFactor,
          visibility,
        );
      }

      animationRef.current = requestAnimationFrame(animate);
    },
    [speed, twinkleRate, isMotionReduced, mode, elementScale],
  );

  const handleResize = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dpr = typeof window !== "undefined" ? Math.min(window.devicePixelRatio || 1, 2) : 1;
    dprRef.current = dpr;
    const width = window.innerWidth;
    const height = window.innerHeight;

    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.scale(dpr, dpr);
    }

    if (mode === "constellation") {
      initConstellation(width, height);
    } else {
      initStars(width, height);
    }
  }, [initStars, initConstellation, mode]);

  useEffect(() => {
    if (!enabled) {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
      fadeStartRef.current = null;
      return;
    }

    // Initial setup
    handleResize();

    const stopAnimation = () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
    };

    const startAnimation = () => {
      if (animationRef.current || !enabled) return;
      const now = performance.now();
      lastTimeRef.current = now;
      if (fadeStartRef.current === null) {
        fadeStartRef.current = now;
      }
      animationRef.current = requestAnimationFrame(animate);
    };

    // Start animation
    const now = performance.now();
    lastTimeRef.current = now;
    fadeStartRef.current = now;
    tabActiveRef.current = !document.hidden && document.hasFocus();
    suspendedUntilPointerRef.current = !tabActiveRef.current;
    if (tabActiveRef.current) {
      animationRef.current = requestAnimationFrame(animate);
    }

    // Handle resize
    window.addEventListener("resize", handleResize);

    const handlePointerMove = (event: MouseEvent) => {
      pointerRef.current.x = event.clientX;
      pointerRef.current.y = event.clientY;
      if (mode === "ambient") {
        pointerRef.current.active = true;
        pointerRef.current.influence = 1;
      }

      if (tabActiveRef.current && (suspendedUntilPointerRef.current || !animationRef.current)) {
        suspendedUntilPointerRef.current = false;
        startAnimation();
      }
    };

    const handleClick = (event: MouseEvent) => {
      if (mode !== "constellation") return;

      const c = constellationRef.current;
      const senderNode = c.nodes[c.endpoint.senderNode];
      const receiverNode = c.nodes[c.endpoint.receiverNode];
      if (!senderNode || !receiverNode) return;

      const aX = senderNode.renderX;
      const aY = senderNode.renderY;
      const bX = receiverNode.renderX;
      const bY = receiverNode.renderY;
      const hitRadius = 30 * elementScale;

      const isA = Math.hypot(event.clientX - aX, event.clientY - aY) <= hitRadius;
      const isB = Math.hypot(event.clientX - bX, event.clientY - bY) <= hitRadius;

      const now = c.elapsed;
      if (isA) {
        c.endpoint.senderPulse = 1;
        c.endpoint.pendingMessages.push({
          source: "A",
          queuedNode: c.endpoint.senderNode,
          targetNode: c.endpoint.receiverNode,
          deadline: now + 60_000,
        });
      }

      if (isB) {
        c.endpoint.receiverPulse = 1;
        c.endpoint.pendingMessages.push({
          source: "B",
          queuedNode: c.endpoint.receiverNode,
          targetNode: c.endpoint.senderNode,
          deadline: now + 60_000,
        });
      }

      if (isA || isB) return;

      let clickedNode = -1;
      for (let i = 0; i < c.nodes.length; i += 1) {
        if (i === c.endpoint.senderNode || i === c.endpoint.receiverNode) continue;
        const node = c.nodes[i];
        const hitRadius = Math.max(14, node.radius + 8) * elementScale;
        if (Math.hypot(event.clientX - node.renderX, event.clientY - node.renderY) <= hitRadius) {
          clickedNode = i;
          break;
        }
      }

      if (clickedNode === -1) return;

      const node = c.nodes[clickedNode];
      if (node.status === "offline") {
        node.status = "healthy";
        c.sync.topologyVersion += 1;
        c.sync.needsSync = true;
        c.sync.quietMs = 0;
        broadcastNetworkLiveness(c, clickedNode);
      } else {
        node.status = "offline";
        node.livenessPending = false;
        node.livenessCursor = 0;
        c.connectedNodes[clickedNode] = false;
        c.sync.topologyVersion += 1;
        c.sync.needsSync = true;
        c.sync.quietMs = 0;
      }

      c.packets = c.packets.filter(
        (packet) => !packet.path.includes(clickedNode),
      );
    };

    const handlePointerLeave = (event: MouseEvent) => {
      if (event.relatedTarget) return;
      if (mode === "ambient") {
        pointerRef.current.active = false;
        pointerRef.current.influence = 0;
      }
    };

    const disableBlackhole = () => {
      pointerRef.current.active = false;
      pointerRef.current.influence = 0;
    };

    const handleVisibility = () => {
      tabActiveRef.current = !document.hidden && document.hasFocus();
      if (document.hidden) {
        suspendedUntilPointerRef.current = true;
        disableBlackhole();
        stopAnimation();
      }
    };

    const handleWindowBlur = () => {
      tabActiveRef.current = false;
      suspendedUntilPointerRef.current = true;
      disableBlackhole();
      stopAnimation();
    };

    const handleWindowFocus = () => {
      tabActiveRef.current = true;
      // Do not resume immediately; wait for pointer movement to minimize idle CPU.
    };

    window.addEventListener("mousemove", handlePointerMove, { passive: true });
    window.addEventListener("click", handleClick);
    window.addEventListener("mouseout", handlePointerLeave);
    window.addEventListener("blur", handleWindowBlur);
    window.addEventListener("focus", handleWindowFocus);
    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("mouseleave", disableBlackhole);

    return () => {
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("mousemove", handlePointerMove);
      window.removeEventListener("click", handleClick);
      window.removeEventListener("mouseout", handlePointerLeave);
      window.removeEventListener("blur", handleWindowBlur);
      window.removeEventListener("focus", handleWindowFocus);
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("mouseleave", disableBlackhole);
      stopAnimation();
    };
  }, [enabled, animate, handleResize, mode]);

  // Update stars when depth changes
  useEffect(() => {
    if (!enabled || mode !== "ambient") return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const stars = starsRef.current;
    const width = canvas.width / dprRef.current;
    const height = canvas.height / dprRef.current;

    // Adjust existing stars for new layer count
    stars.forEach((star) => {
      if (star.layer >= layers) {
        star.layer = layers - 1;
      }
      const baseScale = 0.3 + (star.layer / (layers - 1)) * 0.7;
      star.radius = (0.5 + Math.random() * 1.2) * baseScale;
    });
  }, [layers, enabled, mode]);

  if (!enabled) {
    return null;
  }

  return (
    <canvas
      ref={canvasRef}
      className="starfield-canvas"
      aria-hidden="true"
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        filter: focused ? "none" : "blur(2px)",
        opacity: focused ? 1 : 0.72,
        transform: focused ? "none" : "scale(1.015)",
        transformOrigin: "center",
        pointerEvents: "none",
        zIndex: 1,
      }}
    />
  );
}

interface Star {
  x: number;
  y: number;
  radius: number;
  baseOpacity: number;
  twinklePhase: number;
  twinkleSpeed: number;
  velocityX: number;
  velocityY: number;
  gravityVX: number;
  gravityVY: number;
  layer: number;
  hoverBoost: number;
  respawnDelay: number;
  glowStrength: number;
  twinkleStrength: number;
}

export default Starfield;
