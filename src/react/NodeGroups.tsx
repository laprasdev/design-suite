import React, { type HTMLAttributes } from "react";
import { GroupResize } from "./GroupResize.tsx";
import { ChevronUp } from "lucide-react";
import { Button } from "./Button.tsx";
import type { GraphGroup, GraphNode, GraphGroupResize } from "./nodeGraphTypes.ts";

import { GROUP_SPACE } from "./groupGeometry.ts";
export function NodeGroups({ groups, nodes, onToggle, onResize, groupProps }: {
  groups: readonly GraphGroup[]; nodes: readonly GraphNode[]; onToggle?(id: string): void; onResize?: GraphGroupResize;
  groupProps(id: string): HTMLAttributes<HTMLElement>;
}) {
  return groups.map(group => {
    const members = nodes.filter(node => group.members.includes(node.id));
    return <div key={group.id} className="bd-node-group" data-group={group.id}
      data-completed={group.completed || undefined}
      style={{ left: group.x, top: group.y, width: group.w, height: group.h }}>
      <Button className="bd-node-group-heading" variant="subtle" aria-expanded="true"
        aria-label={`Collapse ${group.label}`} onPointerDown={event => event.stopPropagation()}
        {...groupProps(group.id)} title="Drag to move · Click to fold"
        onClick={() => onToggle?.(group.id)}>
        <ChevronUp size={16} aria-hidden="true" />{group.label}
      </Button>
      {onResize && <GroupResize group={group} onResize={onResize}
        step={Math.max(...members.map(node => Math.max(node.w, node.h)), GROUP_SPACE.heading) + GROUP_SPACE.heading} />}
    </div>;
  });
}
