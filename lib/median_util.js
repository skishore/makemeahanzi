import simplify from '/lib/external/simplify/1.2.2/simplify';

import {assert, Point} from '/lib/base';
import {svg} from '/lib/svg';

const size = 1024;
const rise = 900;
const num_to_match = 8;

let voronoi = undefined;

const filterMedian = (median, n) => {
  const distances = _.range(median.length - 1).map(
      (i) => Math.sqrt(Point.distance2(median[i], median[i + 1])));
  let total = 0;
  distances.map((x) => total += x);
  const result = [];
  let index = 0;
  let position = median[0];
  let total_so_far = 0;
  for (let i of _.range(n - 1)) {
    const target = i*total/(n - 1);
    while (total_so_far < target) {
      const step = Math.sqrt(Point.distance2(position, median[index + 1]));
      if (total_so_far + step < target) {
        index += 1;
        position = median[index];
        total_so_far += step;
      } else {
        const t = (target - total_so_far)/step;
        position = [(1 - t)*position[0] + t*median[index + 1][0],
                    (1 - t)*position[1] + t*median[index + 1][1]];
        total_so_far = target;
      }
    }
    result.push(Point.clone(position));
  }
  result.push(median[median.length - 1]);
  return result;
}

const findLongestShortestPath = (adjacency, vertices, node) => {
  const path = findPathFromFurthestNode(adjacency, vertices, node);
  return findPathFromFurthestNode(adjacency, vertices, path[0]);
}

const findPathFromFurthestNode = (adjacency, vertices, node, visited) => {
  visited = visited || {};
  visited[node] = true;
  let result = [];
  result.distance = 0;
  for (let neighbor of adjacency[node] || []) {
    if (!visited[neighbor]) {
      const candidate = findPathFromFurthestNode(
          adjacency, vertices, neighbor, visited);
      candidate.distance +=
          Math.sqrt(Point.distance2(vertices[node], vertices[neighbor]));
      if (candidate.distance > result.distance) {
        result = candidate;
      }
    }
  }
  result.push(node);
  return result;
}

const findStrokeMedian = (stroke) => {
  const paths = svg.convertSVGPathToPaths(stroke);
  assert(paths.length === 1, `Got stroke with multiple loops: ${stroke}`);

  let polygon = undefined;
  let diagram = undefined;
  for (let approximation of [16, 64]) {
    polygon = svg.getPolygonApproximation(paths[0], approximation);
    voronoi = voronoi || new Voronoi;
    const sites = polygon.map((point) => ({x: point[0], y: point[1]}));
    const bounding_box = {xl: -size, xr: size, yt: -size, yb: size};
    try {
      diagram = voronoi.compute(sites, bounding_box);
      break;
    } catch(error) {
      console.error(`WARNING: Voronoi computation failed at ${approximation}.`);
    }
  }
  assert(diagram, 'Voronoi computation failed completely!');

  diagram.vertices.map((x, i) => {
    x.include = svg.polygonContainsPoint(polygon, [x.x, x.y]);
    x.index = i;
  });
  const vertices = diagram.vertices.map((x) => [x.x, x.y].map(Math.round));
  const edges = diagram.edges.map((x) => [x.va.index, x.vb.index]).filter(
      (x) => diagram.vertices[x[0]].include && diagram.vertices[x[1]].include);
  voronoi.recycle(diagram);

  assert(edges.length > 0);
  const adjacency = {};
  for (let edge of edges) {
    adjacency[edge[0]] = adjacency[edge[0]] || [];
    adjacency[edge[0]].push(edge[1]);
    adjacency[edge[1]] = adjacency[edge[1]] || [];
    adjacency[edge[1]].push(edge[0]);
  }
  const root = edges[0][0];
  const path = findLongestShortestPath(adjacency, vertices, root);
  const points = path.map((i) => vertices[i]);

  const tolerance = 4;
  const simple = simplify(points.map((x) => ({x: x[0], y: x[1]})), tolerance);
  return simple.map((x) => [x.x, x.y]);
}

const normalizeForMatch = (median) => {
  return filterMedian(median, num_to_match).map(
      (x) => [x[0]/size, (rise - x[1])/size]);
}

const median_util = {
  findStrokeMedian: findStrokeMedian,
  normalizeForMatch: normalizeForMatch,
};

export {median_util};
