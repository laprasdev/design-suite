/// <reference path="./react-css.d.ts" />
// @looms/bloom-design/react — generic React primitives.
// Import styles once: `import "@looms/bloom-design/react/styles.css"`.
export { Node, type NodeProps } from "./Node.tsx";
export {
  NodeGraph, type GraphNode, type GraphEdge, type EdgeEnd, type NodeGraphProps, type NodeMove, type NodeMoves,
  type GraphGroup, type GraphGroupResize, type GroupOutlet, type GroupOutlets,
  type GroupEdge, type GroupResizePhase, type TwistTie, graphEdgeId, movedGraph,
} from "./NodeGraph.tsx";
export { isPanKeyHeld } from "./panKey.ts";
export { bezierPath, edgePoint, linkPath, verticalBezierPath, type NodeBox, type NodeSide } from "./geometry.ts";
export { Label, Glyph, Divider, LightBox, type LabelKind } from "./accents.tsx";
export { MonthGrid, type DayCell, type MonthGridProps } from "./Calendar.tsx";
export { Cycle, type CycleOption, type CycleProps } from "./Cycle.tsx";
export { ViewStack, type StackView, type ViewStackProps } from "./ViewStack.tsx";
export { PipRow, PipRowForm, type PipRowFormValue, type PipRowProps } from "./PipRow.tsx";
export { Button, type ButtonProps, type ButtonVariant } from "./Button.tsx";
export { Modal, type ModalProps } from './Modal.tsx';
export { ModalRow, type ModalRowProps, type ModalTitleProps } from './ModalLayout.tsx';
export { ModalElement, ModalPlacement, ModalWidth, ModalFrameInset, MODAL_TITLED_ATTRIBUTE,
  MODAL_ROW_LABELLED_ATTRIBUTE, MODAL_PLACEMENT_ATTRIBUTE, type ModalWidthValue, type ModalFrameInsetValue,
} from './modalElements.ts';
export { PlayerIcon, PlayerStatusRings, type PlayerIconProps, type PhotoRing, type StatusRing, type RingSegment,
  type Hand, type ActiveHand } from './PlayerIcon.tsx';
export { PlayerIconElement, PlayerIconSideElement, type PlayerIconSide } from './playerIconElements.ts';
export { focusableControls } from './focusable.ts';
export { KEPT_ROOM_ATTRIBUTE, SCROLL_STEP_PX, modalGrowthLimit } from './modalRoom.ts';
export { element, type ElementContract } from './elementContract.ts';
export { ApplicationElement, APPLICATION_HOME_ATTRIBUTE } from './applicationElements.ts';
export { Bar, BarContents, type BarProps, type BarSlots } from './Bar.tsx';
export { BarElement, BarSlotElement, barSlotsWithin } from './barElements.ts';
export { ActionBar, type ActionBarProps, type ActionBarNotice } from './ActionBar.tsx';
export { ActionBarElement, ActionBarSlotElement, BarParticipantElement } from './actionBarElements.ts';
export { HoverDetail, type HoverDetailProps } from './HoverDetail.tsx';
export { SegmentedControl, TEXT_SEGMENT_VARIANT, JOINED_SEGMENT_VARIANT, ICON_SEGMENT_VARIANT,
  SEGMENT_GROUP_START_ATTRIBUTE, type SegmentValue, type SegmentOption,
  type SingleSegmentProps } from './SegmentedControl.tsx';
export { type SegmentPending } from './segmentPending.tsx';
export { HeaderIconButton, HEADER_CONTROL_SIZE, GearIcon, SidePanelIcon, ResetIcon } from './HeaderIconButton.tsx';
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
export { Slider } from '../synth/components/synth/Slider.tsx';
export { SliderForm } from './inputs/sliderForm.ts';
export type {SliderProgressProps, SliderProgressSegment} from './inputs/SliderProgress.tsx';
export { PhaseGlyph, type PhaseGlyphValue } from '../synth/components/synth/PhaseGlyph.tsx';
export {ModulationDisplay, ModulationRoot, RangeEnd, type ControlModulator}
  from '../synth/components/synth/modulation.ts';
export { IntegerIncrementer } from '../synth/components/synth/40-IntegerIncrementer.tsx';
export { IncrementerForm } from '../synth/components/synth/incrementerForm.ts';
export {Knob, KnobForm, KnobPreset, type KnobConfig} from '../synth/components/synth/Knob.tsx';
export { Graph } from '../synth/components/synth/Graph.tsx';
export { StyleProvider, useStyle } from '../synth/StyleContext.tsx';
export { CaretButton, type CaretButtonProps } from './CaretButton.tsx';
export {
  PhotoStrip, PhotoCompare, PhotoCompareForm, StripTile, type StripPhoto, type CompareCapture,
} from './Photos.tsx';
export { Crossfade, type CrossfadeProps } from './Crossfade.tsx';
export {
  CrossfadePageElement,PAGE_STACK_MOVING,PAGE_STACK_DIRECTION,type CrossfadePageProps,
} from './CrossfadePage.tsx';
export {
  pageFrames,capturePage,capturePageScroll,restorePageScroll,placePageCopy,removePageCopy,animatePage,
  PAGE_FADE,PAGE_FADE_IN,PAGE_FADE_OUT,PageMotionElement,
  type PageDirection,type PageTiming,type PageAnimation,type PageScroll,type PageCopy,type PageRegions,type PageMotion,
} from './pageMotion.ts';
export {PAGE_MOTION} from './motion.ts';
export { DataTable, DataTableForm, type DataTableProps } from './DataTable.tsx';

export {GraphWires} from "./GraphWires.tsx";
export { graphRoutes } from "./graphRoutes.ts";
export {useThemeSource} from './useThemeSource.ts';

export {ElementsGallery, type ElementsGalleryProps} from './gallery/ElementsGallery.tsx';

export {CodeIcon, ServerIcon, LibraryIcon} from './HeaderIconButton.tsx';
export {PageHeaderBar, HeaderNavigation, HeaderBrand, HeaderBack,
  PageFooter, PageFooterContents, pageFooterSlots,
  type PageHeaderBarProps, type PageFooterProps, type FooterAction} from './PageBar.tsx';
export {RecordTable, type RecordTableProps, type RecordRowsProps, type RecordColumn,
  type RecordIdentity, type TableRecord, type ColumnGroup, type RowState,
  type RowWindow, type TableSort} from './table/RecordTable.tsx';
export {windowedRange, type ListViewport} from './table/useTableWindow.ts';

export {GooExpander, GooForm, type GooExpanderProps} from './GooExpander.tsx';
export {useDoubleTap} from './useDoubleTap.ts';
export {graphDots, graphEdgeFade, nodeFrame} from './graphSurface.ts';
export {GraphDisplay, GraphFill} from './GraphDisplay.tsx';
export {animateCardFlip} from './cardFlip.ts';

export {ControllerShoulder, ControllerDpad} from './controllerShapes.tsx';

export { ModuleTextInput, TextInput, type TextInputProps } from './inputs/ModuleTextInput.tsx';
export { ModulationSocket } from './inputs/ModulationSocket.tsx';

export {PlaybackArrows, PlayIcon, PauseIcon, FastForwardIcon, SuperFastForwardIcon} from './PlaybackIcons.tsx';

export {useFontReadiness} from './useFontReadiness.ts';

export {HeaderSky} from './sky/HeaderSky.tsx';
export {ThemeMoon, type ThemeMoonProps} from './sky/ThemeMoon.tsx';

export {BaseContainer, type BaseContainerProps} from '../synth/components/synth/base/BaseContainer.tsx';
