import type { GraphGroup, GraphNode } from "./nodeGraphTypes.ts";

export const GROUP_SPACE = Object.freeze({ inset: 16, heading: 44 });

/** The visible frame grows around moved members. Rendering, resizing and routing share these bounds. */
export function groupFrames(groups: readonly GraphGroup[], nodes: readonly GraphNode[]): GraphGroup[] {
  return groups.map(group => {
    const members = nodes.filter(node => group.members.includes(node.id));
    const x = Math.min(group.x, ...members.map(node => node.x - GROUP_SPACE.inset));
    const y = Math.min(group.y, ...members.map(node => node.y - GROUP_SPACE.heading));
    const right = Math.max(group.x + group.w, ...members.map(node => node.x + node.w + GROUP_SPACE.inset));
    const bottom = Math.max(group.y + group.h, ...members.map(node => node.y + node.h + GROUP_SPACE.inset));
    return { ...group, x, y, w: right - x, h: bottom - y };
  });
}
