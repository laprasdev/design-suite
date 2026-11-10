// The Routing module on a page: cards on a canvas that pans and zooms, and its outputs on a rail beside it.
// LayoutDimensions.routing is this, kept in its own file so layout.ts holds its size. Most sizes are Fibonacci
// numbers, so neighbouring sizes stand in φ.

const NODE_WIDTH = 144;

export const RoutingDimensions = {
  nodeWidth: NODE_WIDTH,
  nodeHeader: 21,
  nodeRow: 26,
  nodePadding: 5,
  nodeRadius: 8,
  columnGap: 34,
  rowGap: 13,
  // Vertical spacing between independent chain summaries.
  bandGap: 55,
  // Between the canvas's edge and the outputs, so a wire cut off at the edge never reads as reaching an output.
  edgeGap: 13,
  // How long a node that a reference opened stays marked.
  markMs: 1600,
  canvasInset: 21,
  canvasEnd: 34,
  portSize: 12,
  // Six operators across a node's row, inside its padding and ports.
  operatorSize: 20,
  wireBend: 55,
  wireWidth: 2,
  wireDash: 5,
  portStroke: 2,
  gridStep: 21,
  gridLine: 1,
  // The outputs: a rail of one icon a group, each opening the group's card beside it. A row is the rail's button,
  // and each terminal. The middle terminal stands level with the icon.
  outputRow: 21,
  outputIcon: 13,
  outputCardWidth: 34,
  outputPadding: 3,
  menuWidth: 233,
  menuOffset: 8,
  panCueSize: 21,
  panCueIcon: 14,
  panStep: 0.8,
  moveSlack: 3,
  // How far the canvas zooms, out to 1/φ² and in to φ, and how many wheel pixels zoom it by φ. A trackpad's pinch
  // is a wheel with Control held.
  zoomMin: 0.382,
  zoomMax: 1.618,
  zoomWheelPx: 233,
  minWidth: 480,
  minHeight: 320,
} as const;
