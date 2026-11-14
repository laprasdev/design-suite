import {Button} from '../Button.tsx';
import {SegmentedControl, ICON_SEGMENT_VARIANT} from '../SegmentedControl.tsx';
import {KeyMoment, PageKey, onPageKey} from '../pageKeys.ts';
// The theme, behind the moon crossing the header's sky. The moon is tonight's: its real phase, lit on the side the sun
// is. Press it, or hold Shift over it, and a swatch for each skin comes out toward the open side of the sky: the
// skin's colours
// as rings and a fill, no words. Pressing one switches the theme. Five seconds with no input over them and they tuck
// back behind the moon, as the game's audio controls do.
import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { litPath, lunarPhase } from './lunarPhase.ts';

export const REVEAL_IDLE_MS = 5000;
// The phase is read again on this beat, so a desk left open overnight shows the next night's moon.
const PHASE_REFRESH_MS = 3_600_000;
const SHIFT = 'Shift';

// A skin's swatch: its primary as the outer ring, its secondary as the inner ring, and its tertiary, when it has one,
// as the fill; the background shows through otherwise.
interface PaletteChoice {id: string; palette: {primary: string; secondary?: string; tertiary?: string;
  background: string};}
export interface ThemeMoonProps {
  skins: readonly PaletteChoice[]; skin: string; onSkin(value: string): void;
  fan(): typeof FanSide[keyof typeof FanSide]; onOpen(): void;
}
function Swatch({skin}: {skin: PaletteChoice}) {
  const {primary, secondary, tertiary, background} = skin.palette;
  return <svg viewBox="0 0 20 20" aria-hidden="true">
    <circle cx="10" cy="10" r="9" fill={background} stroke={primary} strokeWidth="2"/>
    <circle cx="10" cy="10" r="5.5" fill={tertiary ?? background} stroke={secondary ?? primary} strokeWidth="2"/>
  </svg>;
}

const DISC = { cx: 10, cy: 10, r: 8 };
// The whole disc faintly, its dark side showing as earthshine, and the lit part over it.
const Moon = ({phase}: {phase: ReturnType<typeof lunarPhase>}) => (
  <svg className="theme-moon-face" viewBox="0 0 20 20" aria-hidden="true">
    <circle className="theme-moon-dark" cx={DISC.cx} cy={DISC.cy} r={DISC.r} />
    <path className="theme-moon-lit" d={litPath(phase, DISC)} />
  </svg>
);

// The side the swatches fan out to, toward the open sky; each lists nearest the moon first.
export const FanSide = Object.freeze({ LEFT: 'left', RIGHT: 'right' });

function useTonightsPhase() {
  const [phase, setPhase] = useState(() => lunarPhase(new Date()));
  useEffect(() => {
    const timer = setInterval(() => setPhase(lunarPhase(new Date())), PHASE_REFRESH_MS);
    return () => clearInterval(timer);
  }, []);
  return phase;
}

export function ThemeMoon({skins, skin, onSkin, fan, onOpen}: ThemeMoonProps) {
  const [open, setOpen] = useState(false);
  const [side, setSide] = useState<typeof FanSide[keyof typeof FanSide]>(FanSide.LEFT);
  const phase = useTonightsPhase();
  const root = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => { if (open) onOpen(); }, [open, onOpen]);
  // Read the actual resting position when opening: the crossing clock may
  // have paused with the picker, so wall time no longer describes its place.
  useLayoutEffect(() => { if (open) setSide(fan()); }, [open, fan]);
  // Shift over the moon opens it; real input over the moon or the swatches keeps it open; idle closes it.
  useEffect(() => {
    const node = root.current;
    if (!node) throw new Error('Theme picker is not mounted');
    let timer: ReturnType<typeof setTimeout> | undefined;
    const idle = () => { clearTimeout(timer); timer = setTimeout(() => setOpen(false), REVEAL_IDLE_MS); };
    const hovered = () => node.matches(':hover');
    const key = (e: KeyboardEvent) => { if (e.key === SHIFT && !e.repeat && hovered()) setOpen(true); else if (open
      && hovered()) idle(); };
    const enter = (e: PointerEvent) => { if (e.shiftKey) setOpen(true); };
    node.addEventListener('pointerenter', enter);
    node.addEventListener('pointerdown', idle);
    const stopHearing = onPageKey(PageKey.DOWN, KeyMoment.PAGE_AFTER_FOCUS, key);
    if (open) idle();
    return () => {
      clearTimeout(timer);
      node.removeEventListener('pointerenter', enter);
      node.removeEventListener('pointerdown', idle);
      stopHearing();
    };
  }, [open]);
  return (
    <div className="theme-moon" ref={root} data-open={open || undefined}>
      <div className="theme-swatches" data-side={side} ref={node => {if (node) node.inert = !open;}}>
        <SegmentedControl ariaLabel="Theme" value={skin} onChange={onSkin} variant={ICON_SEGMENT_VARIANT} iconOnly
          cell="var(--swatch-size)"
          options={skins.map((choice, index) => ({value: choice.id, ariaLabel: choice.id, title: choice.id,
            className: 'theme-swatch', style: {'--swatch-index': index}, label: <Swatch skin={choice}/>}))}/>
      </div>
      <Button variant="subtle"
        type="button" className="theme-moon-button" aria-label="Theme" aria-expanded={open}
        title={`${phase.name}, ${Math.round(phase.illuminated * 100)}% lit`} onClick={() => setOpen(x => !x)}
      >
        <Moon phase={phase} />
      </Button>
    </div>
  );
}
