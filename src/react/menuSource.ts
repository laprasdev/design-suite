import type {DataTableProps} from './DataTable.tsx';
import type {SegmentOption} from './SegmentedControl.tsx';

// The menu and sidebar halves of an overlay, translating C#'s IHciCollectionViewDataSource (sections, rows, a cell
// per index) and IHciCollectionActionDelegate (the selection). The engine owns the stack, the selection and what an
// activation does; a source carries only what is drawn, and reports input back through its delegate.

/** A cell's place: its section, then its row within that section. */
export interface CellIndex {readonly section: number; readonly row: number}

/** The data a row holds chooses its control: inert text, a row that activates, a boolean, a choice among options,
 * named values, or the input bound to an action. */
export const MenuCellKind=Object.freeze({
 TEXT:'text',ACTION:'action',TOGGLE:'toggle',CHOICE:'choice',DETAILS:'details',BINDING:'binding',
} as const);
export type MenuCellKind=typeof MenuCellKind[keyof typeof MenuCellKind];
export type MenuChoiceOption=Pick<SegmentOption<string>,'value'|'label'>;
interface MenuCellValues {
 [MenuCellKind.TEXT]: {};
 [MenuCellKind.ACTION]: {};
 [MenuCellKind.TOGGLE]: {readonly value: boolean};
 [MenuCellKind.CHOICE]: {readonly options: readonly MenuChoiceOption[]; readonly value: string};
 [MenuCellKind.DETAILS]: {readonly rows: DataTableProps['rows']};
 [MenuCellKind.BINDING]: {readonly input: string};
}
export type MenuCell={[K in MenuCellKind]: {readonly kind: K; readonly label: string}&MenuCellValues[K]}[MenuCellKind];

export interface MenuRow {readonly key: string; readonly cell: MenuCell}
export interface MenuSection {readonly key: string; readonly rows: readonly MenuRow[]}

/** Input a person gives a menu, sent to the engine, which decides what it does. */
export interface MenuDelegate {
 select(index: CellIndex): void;
 activate(index: CellIndex): void;
 choose(index: CellIndex, value: string): void;
}

/** What a content view on the menu stack shows: the rows of a collection, or the synth's page shell. */
export const MenuViewKind=Object.freeze({COLLECTION:'collection',SYNTH:'synth'} as const);
export type MenuViewKind=typeof MenuViewKind[keyof typeof MenuViewKind];
interface MenuViewValues {
 [MenuViewKind.COLLECTION]: {
  readonly title: string; readonly sections: readonly MenuSection[]; readonly selected: CellIndex;
 };
 [MenuViewKind.SYNTH]: {};
}
export type MenuView={[K in MenuViewKind]: {readonly kind: K; readonly key: string}&MenuViewValues[K]}[MenuViewKind];

/** The menu a stack rests on, after C#'s NavigationParentMenus: the one shown before play, or the one over it. */
export const MenuRoot=Object.freeze({START:'start',PAUSE:'pause'} as const);
export type MenuRoot=typeof MenuRoot[keyof typeof MenuRoot];
/** The stack of content views over its root, the root's own view first and the view drawn last. */
export interface MenuSource {
 readonly root: MenuRoot;
 readonly stack: readonly [MenuView,...MenuView[]];
 readonly delegate: MenuDelegate;
}

/** A rail of groups beside the content, each top-level cell nesting its own rows (C#'s SidebarFullNestedCollection). */
export interface SidebarGroup {readonly key: string; readonly label: string; readonly sections: readonly MenuSection[]}
export interface SidebarSource {
 readonly groups: readonly [SidebarGroup,...SidebarGroup[]];
 readonly group: number;
 readonly selected: CellIndex;
 readonly delegate: MenuDelegate&{selectGroup(group: number): void};
}
