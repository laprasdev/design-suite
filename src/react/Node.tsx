// =====================================================
// Node — a generic beveled card, absolutely positioned. Domain-free: the
// consumer supplies position, size, an optional accent flag, and any content.
// =====================================================
import React, { type CSSProperties, type HTMLAttributes, type ReactNode } from "react";
import { NodeGraphElement } from "./nodeGraphElements.ts";

export interface NodeProps extends Omit<HTMLAttributes<HTMLDivElement>, "style" | "className" | "children"> {
  x: number;
  y: number;
  w: number;
  h: number;
  accent?: boolean;
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
}

export function Node({ x, y, w, h, accent = false, className = "", style, children, ...rest }: NodeProps) {
  return (
    <div
      className={[NodeGraphElement.NODE.className, accent && NodeGraphElement.NODE_ACCENT.className, className]
        .filter(Boolean).join(" ")}
      style={{ position: "absolute", left: x, top: y, width: w, height: h, ...style }}
      {...rest}
    >
      {children}
    </div>
  );
}
