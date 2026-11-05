// @looms/bloom-design/react — generic React primitives.
// Import styles once: `import "@looms/bloom-design/react/styles.css"`.
export { Node, type NodeProps } from "./Node.tsx";
export {
  NodeGraph, type GraphNode, type GraphEdge, type EdgeEnd, type NodeGraphProps, type NodeMove, type NodeMoves,
} from "./NodeGraph.tsx";
export { isPanKeyHeld } from "./panKey.ts";
export { bezierPath, edgePoint, linkPath, verticalBezierPath, type NodeBox, type NodeSide } from "./geometry.ts";
export { Label, Glyph, Divider, LightBox, type LabelKind } from "./accents.tsx";
export { MonthGrid, type DayCell, type MonthGridProps } from "./Calendar.tsx";
export { Cycle, type CycleOption, type CycleProps } from "./Cycle.tsx";
export { ViewStack, type StackView, type ViewStackProps } from "./ViewStack.tsx";
export { PipRow, type PipRowProps } from "./PipRow.tsx";
export { Button, type ButtonProps, type ButtonVariant } from "./Button.tsx";
export { Modal, type ModalProps } from './Modal.tsx';
export { PlayerIcon, PlayerStatusRings, type PlayerIconProps, type PhotoRing, type StatusRing, type RingSegment, type Hand, type ActiveHand } from './PlayerIcon.tsx';
export { focusableControls } from './focusable.ts';
export { KEPT_ROOM_ATTRIBUTE, SCROLL_STEP_PX, modalGrowthLimit } from './modalRoom.ts';
export { element, type ElementContract } from './elementContract.ts';
export { ApplicationElement, APPLICATION_HOME_ATTRIBUTE } from './applicationElements.ts';
export { Bar, BarContents, type BarProps, type BarSlots } from './Bar.tsx';
export { BarElement, BarSlotElement, barSlotsWithin } from './barElements.ts';
export { ActionBar } from './ActionBar.tsx';
export { ActionBarElement, ActionBarSlotElement, BarParticipantElement } from './actionBarElements.ts';
export { HoverDetail } from './HoverDetail.tsx';
export { SegmentedControl, TEXT_SEGMENT_VARIANT, JOINED_SEGMENT_VARIANT, ICON_SEGMENT_VARIANT, SEGMENT_GROUP_START_ATTRIBUTE, type SegmentValue, type SegmentOption, type SingleSegmentProps } from './SegmentedControl.tsx';
export { HeaderIconButton, GearIcon, SidePanelIcon } from './HeaderIconButton.tsx';
export { SegmentDefaultsContext, type SegmentDefaults } from './segmentContext.ts';
export { BarParticipants, type BarParticipant } from './BarParticipants.tsx';
export { SelectionMark } from './SelectionMark.tsx';
export { SearchField, type SearchFieldProps } from './SearchField.tsx';
export { ListboxSelect, type ListboxOption } from './ListboxSelect.tsx';
export { GlowParticles } from './GlowParticles.tsx';
export {
  LoadingIndicator, LoadingScreen, POKEBALL_OUTLINE, PokeballIcon, PokeballOutline, PokeballSpinner,
} from './Pokeball.tsx';
export { GlowParticleElement, LoadingElement } from './loadingElements.ts';
export { CSS_ZOOM_PROPERTY, cssRect, cssViewport, zoomOf, type CssRect } from './cssZoom.ts';
export { useAnchoredPopover, VIEWPORT_EDGE, type PopoverPlacement } from './useAnchoredPopover.ts';
export { PARTICIPANT_GRASS, PARTICIPANT_GRASS_BEND } from './participantGrass.ts';
export { ListboxElement } from './listboxSelectElements.ts';
export { SettingElement, METER_VALUE_ATTRIBUTE, METER_FIXED_ATTRIBUTE } from './settingElements.ts';
export { Boolean, BooleanForm } from '../synth/components/synth/Boolean.tsx';
export { Slider, SliderForm } from '../synth/components/synth/Slider.tsx';
export { PhaseGlyph, type PhaseGlyphValue } from '../synth/components/synth/PhaseGlyph.tsx';
export { ModulationRoot, RangeEnd, type ControlModulator } from '../synth/components/synth/modulation.ts';
export { IntegerIncrementer, IncrementerForm } from '../synth/components/synth/40-IntegerIncrementer.tsx';
export { Knob } from '../synth/components/synth/Knob.tsx';
export { Graph } from '../synth/components/synth/Graph.tsx';
export { StyleProvider, useStyle } from '../synth/StyleContext.tsx';
export { CaretButton, type CaretButtonProps } from './CaretButton.tsx';
export { PhotoStrip, PhotoCompare, type StripPhoto, type CompareCapture } from './Photos.tsx';
export { Crossfade, type CrossfadeProps } from './Crossfade.tsx';
export {
  CrossfadePageElement,PAGE_STACK_MOVING,PAGE_STACK_DIRECTION,type CrossfadePageProps,
} from './CrossfadePage.tsx';
export {
  pageFrames,capturePage,capturePageScroll,restorePageScroll,placePageCopy,animatePage,
  PAGE_FADE,PAGE_FADE_IN,PAGE_FADE_OUT,PageMotionElement,
  type PageDirection,type PageTiming,type PageAnimation,type PageScroll,type PageCopy,type PageRegions,type PageMotion,
} from './pageMotion.ts';
export {PAGE_MOTION} from './motion.ts';
export { DataTable, type DataTableProps } from './DataTable.tsx';
