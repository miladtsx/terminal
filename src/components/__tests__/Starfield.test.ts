import { describe, expect, it } from "vitest";
import {
  removeDirectAdjacency,
} from "../Starfield";

describe("removeDirectAdjacency", () => {
  it("removes an existing direct endpoint edge from adjacency and edges", () => {
    const adjacency = [[1, 2], [0], [0]];
    const edges = [
      { from: 0, to: 1, phase: 0.1 },
      { from: 0, to: 2, phase: 0.2 },
    ];

    removeDirectAdjacency(adjacency, edges, 0, 2);

    expect(adjacency[0]).not.toContain(2);
    expect(adjacency[2]).not.toContain(0);
    expect(
      edges.some(
        (edge) =>
          (edge.from === 0 && edge.to === 2) ||
          (edge.from === 2 && edge.to === 0),
      ),
    ).toBe(false);
  });
  it("is safe when direct endpoint edge does not exist", () => {
    const adjacency = [[1], [0, 2], [1]];
    const edges = [
      { from: 0, to: 1, phase: 0.11 },
      { from: 1, to: 2, phase: 0.22 },
    ];

    removeDirectAdjacency(adjacency, edges, 0, 2);

    expect(adjacency[0]).not.toContain(2);
    expect(adjacency[2]).not.toContain(0);
    expect(
      edges.some(
        (edge) =>
          (edge.from === 0 && edge.to === 2) ||
          (edge.from === 2 && edge.to === 0),
      ),
    ).toBe(false);
  });
});