/* PlayerIcon — the one player-headshot primitive. A round photo carrying any of
   a set of optional adornments, each switched on by a prop (composition, not
   variants): a progress ring, a handedness dot (L / R / S), top-corner accents
   (e.g. a rating + a secondary metric), a selected highlight, a faded state, and
   tap-to-act. `photo` is a slot — the host passes its own avatar element — so the
   package stays model-agnostic; `tone` maps to the host's --teal / --pink. Any
   surrounding text (name, position) is composed AROUND this by the caller. */

import type { CSSProperties, MouseEvent, ReactNode } from 'react';
import { PHI } from '../layout.ts';
import { PlayerIconElement, PlayerIconSideElement, type PlayerIconSide } from './playerIconElements.ts';

const RING = { size: 120, radius: 56, stroke: 6 };
const STATUS_STROKE = RING.stroke * PHI;
const RING_GAP = RING.stroke / PHI;
// The hand that is active, on its side of the photo, and the hands the player bats/throws from (S: both).
export type ActiveHand = PlayerIconSide;
export type Hand = ActiveHand | 'S';
// A part on one side of the photo carries its own class and its side's.
const sidedClass = (part: keyof typeof PlayerIconSideElement, side: PlayerIconSide) =>
  `${PlayerIconElement[part].className} ${PlayerIconSideElement[part][side].className}`;
interface HandDotsProps {
  hand: Hand;
  activeHand?: ActiveHand | null;
  handBonus?: number;
  handBonusLabel?: string;
}

/* One or two dots marking the hand the player bats/throws from (S → both). */
function HandDots({ hand, activeHand, handBonus = 0, handBonusLabel }: HandDotsProps) {
  const left = hand === "L" || hand === "S";
  const right = hand === "R" || hand === "S";
  return (
    <>
      {([['L',left],['R',right]] as const).filter(([,visible])=>visible).map(([side])=><span key={side} className={sidedClass('DOT', side)} data-active={activeHand?activeHand===side:undefined} title={activeHand===side?`${side==='L'?'Left':'Right'} hand active${handBonus?` · +${handBonus} ${handBonusLabel||''}`:''}`:undefined}>{activeHand===side&&handBonus>0&&<b className={PlayerIconElement.HAND_BONUS.className} aria-label={`+${handBonus} ${handBonusLabel||'handedness bonus'}`}>+{handBonus}</b>}</span>)}
    </>
  );
}

/* A ring around the photo showing `pct` of a full turn (stamina, warm-up, …),
   beginning `start` of a turn after the top. `segments` instead draws several
   arcs of the one ring, each { start, pct, opacity, glow }. Empty arcs draw nothing. */
// An arc of a ring: where it starts (a fraction of a turn after the top), how much
// of a turn it covers, and its opacity and glow.
export interface RingSegment {
  start?: number;
  pct: number;
  opacity?: number;
  glow?: boolean;
}
const clamp01 = (n: number) => Math.max(0, Math.min(1, n));
// An arc's ends, in turns after the top; its end can pass a full turn.
const arcStart = (arc: RingSegment) => clamp01(arc.start ?? 0);
const arcEnd = (arc: RingSegment) => arcStart(arc) + clamp01(arc.pct);
// Ends that differ by whole turns are one point of the ring, to within the rounding of the fractions a host adds to
// place them: 8 units in the last place of a turn between 1 and 2, the largest an end reaches, each 2⁻⁵²
// (Number.EPSILON).
const TURN_ROUNDING = 8 * Number.EPSILON;
const sameTurn = (a: number, b: number) => Math.abs(a - b - Math.round(a - b)) < TURN_ROUNDING;
interface RingArcProps {
  pct: number;
  color?: string;
  start?: number;
  segments?: readonly RingSegment[];
  radius?: number;
  stroke?: number;
  status?: boolean;
  label?: string;
}
function RingArc({ pct, color, start = 0, segments, radius = RING.radius, stroke = RING.stroke, status = false, label }: RingArcProps) {
  const R = radius, center = RING.size / 2;
  const arcs: readonly RingSegment[] = (segments || [{ start, pct }]).filter((arc) => arc.pct > 0);
  const point = (turn: number): [number, number] =>
    [center + R * Math.cos(turn * 2 * Math.PI), center + R * Math.sin(turn * 2 * Math.PI)];
  // Actual arc paths avoid dashed-circle/filter fragments when a small ring is
  // rotated or scaled by the field. Two half-arcs also represent a full circle.
  const path = (arc: RingSegment) => {
    const from = arcStart(arc), to = arcEnd(arc);
    return `M${point(from)} A${R} ${R} 0 0 1 ${point((from + to) / 2)} A${R} ${R} 0 0 1 ${point(to)}`;
  };
  // Arcs end flush, so adjoining segments never overlap their colours; an end no arc continues
  // is rounded. A full turn continues itself. This serves a single progress arc and a segmented ring.
  const exposedEnds = (arc: RingSegment) => [
    {turn: arcStart(arc), joined: arcs.some(other => sameTurn(arcStart(arc), arcEnd(other)))},
    {turn: arcEnd(arc), joined: arcs.some(other => sameTurn(arcEnd(arc), arcStart(other)))},
  ].filter(end => !end.joined).map(end => point(end.turn));
  return (
    <svg className={`${PlayerIconElement.RING.className}${status ? ` ${PlayerIconElement.STATUS_RING.className}` : ''}`} viewBox={`0 0 ${RING.size} ${RING.size}`} aria-hidden={label ? undefined : true} role={label ? 'img' : undefined} aria-label={label} style={{ color }}>
      {label && <title>{label}</title>}
      {/* One layer an arc: its opacity and glow apply once to the stroke and its round ends together. */}
      {arcs.map((arc, i) =>
        <g key={i} className={PlayerIconElement.ARC.className} data-glow={!!arc.glow} opacity={arc.opacity ?? 1}>
          <path className={PlayerIconElement.STROKE.className} d={path(arc)}
            style={{ stroke: color, strokeWidth: stroke }} />
          {exposedEnds(arc).map(([x, y], end) => <circle key={end} className={PlayerIconElement.CAP.className}
            cx={x} cy={y} r={stroke / 2} style={{ fill: color }} />)}
        </g>)}
    </svg>
  );
}

// Each status occupies the next outer rung. Percentages use a fraction of a
// turn; an active status without a percentage uses a full turn.
// A status ring: its id, its share of a turn (a full turn by default), its color
// and spoken label.
export interface StatusRing {
  id: string;
  pct?: number;
  color?: string;
  label?: string;
  start?: number;
  segments?: readonly RingSegment[];
}
export function PlayerStatusRings({ rings }: { rings: readonly StatusRing[] }) {
  return rings.map(({ id, pct = 1, ...ring }, layer) => <RingArc key={id} {...ring} pct={pct} status
    stroke={STATUS_STROKE} radius={RING.radius + (RING.stroke + STATUS_STROKE) / 2 + RING_GAP + layer * (STATUS_STROKE + RING_GAP)} />);
}

// The photo's progress ring: its share of a turn, its start, color and segments.
export interface PhotoRing {
  pct?: number;
  start?: number;
  color?: string;
  segments?: readonly RingSegment[];
}
export interface PlayerIconProps {
  photo: ReactNode;
  badge?: ReactNode;
  size?: number;
  tone?: string;
  ring?: PhotoRing | null;
  statusRings?: readonly StatusRing[];
  hand?: Hand | null;
  activeHand?: ActiveHand | null;
  handBonus?: number;
  handBonusLabel?: string;
  topLeft?: ReactNode;
  topRight?: ReactNode;
  selected?: boolean;
  faded?: boolean;
  bare?: boolean;
  title?: string;
  onTap?: (event: MouseEvent<HTMLButtonElement>) => void;
  className?: string;
}
export function PlayerIcon({ photo, badge, size = 40, tone, ring, statusRings = [], hand, activeHand, handBonus, handBonusLabel, topLeft, topRight, selected, faded, bare, title, onTap, className = "" }: PlayerIconProps) {
  const cls = [PlayerIconElement.ROOT.className, onTap && PlayerIconElement.BUTTON.className,
    selected && PlayerIconElement.SELECTED.className, faded && PlayerIconElement.FADED.className,
    bare && PlayerIconElement.BARE.className, className].filter(Boolean).join(" ");
  const inner = (
    <>
      <span className={PlayerIconElement.PHOTO.className}>{photo}</span>
      {ring && <RingArc pct={ring.pct ?? 1} start={ring.start} color={ring.color} segments={ring.segments} />}
      <PlayerStatusRings rings={statusRings} />
      {hand && <HandDots hand={hand} activeHand={activeHand} handBonus={handBonus} handBonusLabel={handBonusLabel}/>}
      {topLeft != null && <span className={sidedClass('ACCENT', 'L')}>{topLeft}</span>}
      {topRight != null && <span className={sidedClass('ACCENT', 'R')}>{topRight}</span>}
      {badge}
    </>
  );
  const style: CSSProperties = { "--pi-size": `${size}px` };
  return onTap
    ? <button type="button" className={cls} data-tone={tone} style={style} title={title} onClick={onTap}>{inner}</button>
    : <span className={cls} data-tone={tone} style={style} title={title}>{inner}</span>;
}
