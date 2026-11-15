// Bot pathing: the waypoint graph of Cinder Yard, BFS pathfinding over it, and
// multi-leg routes through waypoints. One job: given where a bot is and where it
// wants to go, say which nodes to walk. It never touches the simulation — the bots
// ask it for a path, then walk it themselves with the shared mover.
export const NODES = [
  [0, 15], [-5, 14], [5, 14], [0, 10], [-10, 10], [10, 10], [-10, 5], [10, 5],
  [0, 5], [0, 0], [0, -5], [-10, -2], [10, -2], [-10, -9], [10, -9], [0, -11],
  [-6, -12], [6, -12], [-14, -12], [14, -12], [-16.5, -12.5], [16.5, -12.5],
  [0, -15], [-6, -15], [6, -15], [-16, -6], [16, -6],
];
export const EDGES = [
  [0, 1], [0, 2], [0, 3], [1, 4], [2, 5], [3, 4], [3, 5], [3, 8], [4, 6], [5, 7],
  [6, 11], [7, 12], [8, 9], [9, 10], [10, 15], [11, 13], [12, 14], [13, 18],
  [14, 19], [25, 18], [26, 19], [18, 20], [19, 21], [15, 16],
  [15, 17], [15, 22], [16, 18], [17, 19], [16, 22], [17, 22], [22, 23], [22, 24],
  [23, 18], [24, 19], [20, 25], [21, 26], [3, 6], [3, 7],
];

export function createNav(nodes = NODES, edges = EDGES) {
  const adjacency = nodes.map(() => []);
  for (const [a, b] of edges) {
    adjacency[a].push(b);
    adjacency[b].push(a);
  }

  function nearestNode(x, z) {
    let best = 0;
    let bestDist = Infinity;
    for (let i = 0; i < nodes.length; i += 1) {
      const dx = nodes[i][0] - x;
      const dz = nodes[i][1] - z;
      const d = dx * dx + dz * dz;
      if (d < bestDist) { bestDist = d; best = i; }
    }
    return best;
  }

  function findPath(from, to) {
    if (from === to) return [from];
    const prev = new Array(nodes.length).fill(-1);
    const queue = [from];
    prev[from] = from;
    while (queue.length) {
      const node = queue.shift();
      for (const next of adjacency[node]) {
        if (prev[next] !== -1) continue;
        prev[next] = node;
        if (next === to) {
          const path = [to];
          let cur = to;
          while (cur !== from) { cur = prev[cur]; path.unshift(cur); }
          return path;
        }
        queue.push(next);
      }
    }
    return [from];
  }

  function routeThrough(fromNode, via) {
    let path = [fromNode];
    let cur = fromNode;
    for (const node of via) {
      const leg = findPath(cur, node);
      path = path.concat(leg.slice(1));
      cur = node;
    }
    return path;
  }

  return { nodes, adjacency, nearestNode, findPath, routeThrough };
}
