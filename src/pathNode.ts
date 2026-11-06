// The path vocabulary: one node shape for everything laid out on a project's path to its destination (tasks,
// questions, checkpoints, and references read from elsewhere), and the words its status speaks. No React, so a
// server, a command line and the views all read it, and one view draws any node from the same fields.

/** What part a node plays on the path. The destination is the last checkpoint, not a kind of its own. */
export const NodeKind = Object.freeze({
  TASK: 'task', QUESTION: 'question', CHECKPOINT: 'checkpoint', REFERENCE: 'reference',
} as const);
export type NodeKindValue = typeof NodeKind[keyof typeof NodeKind];

/** A node's stored state. Wip and discuss are older states that nothing sets now. */
export const NodeState = Object.freeze({ TBD: 'tbd', WIP: 'wip', DISCUSS: 'discuss', APPROVED: 'approved' } as const);
export type NodeStateValue = typeof NodeState[keyof typeof NodeState];

/**
 * InfiniteStateMachine's LifecyclePhase (ObjectStateConfiguration+Utilities.cs), as a checkpoint uses it: Idle until
 * the checkpoint before passes, Accelerating while its work is planned, Active, then Decelerating for its review.
 * CoolOff and Holding have no checkpoint meaning.
 */
export const LifecyclePhase = Object.freeze({
  IDLE: 'idle', ACCELERATING: 'accelerating', ACTIVE: 'active', DECELERATING: 'decelerating',
} as const);
export type LifecyclePhaseValue = typeof LifecyclePhase[keyof typeof LifecyclePhase];

/** Where a task is on its way to done, in the order it moves. */
export const TaskStage = Object.freeze({
  WAITING: 'waiting', READY: 'ready', WORKING: 'working', REVIEW: 'review', DONE: 'done', RESOLVED: 'resolved',
} as const);
export type TaskStageValue = typeof TaskStage[keyof typeof TaskStage];

/** The two seats that sign a checkpoint off, and what each can say. */
export const Reviewer = Object.freeze({ FABLE: 'fable', OWNER: 'owner' } as const);
export type ReviewerValue = typeof Reviewer[keyof typeof Reviewer];
export const Verdict = Object.freeze({ SIGNED: 'signed', REJECTED: 'rejected' } as const);
export type VerdictValue = typeof Verdict[keyof typeof Verdict];
/** The model that sat in Fable's seat. Opus stands in when Fable is at its limit, and says so. */
export const ReviewModel = Object.freeze({ FABLE: 'fable', OPUS: 'opus' } as const);
export type ReviewModelValue = typeof ReviewModel[keyof typeof ReviewModel];
export const ReviewStatus = Object.freeze({
  NOT_READY: 'not-ready', READY: 'ready', REJECTED: 'rejected', PASSED: 'passed',
} as const);
export type ReviewStatusValue = typeof ReviewStatus[keyof typeof ReviewStatus];

/** What happened to a node, in its own log. */
export const LogVerb = Object.freeze({
  ADDED: 'added', ASKED: 'asked', CLAIMED: 'claimed', RELEASED: 'released', NOTED: 'noted', FINISHED: 'finished',
  ATTACHED: 'attached', REVISED: 'revised', WITHDREW: 'withdrew', LINKED: 'linked', PROPOSED: 'proposed',
  REVIEWED: 'reviewed', ASSIGNED: 'assigned', RESOLVED: 'resolved',
} as const);
export type LogVerbValue = typeof LogVerb[keyof typeof LogVerb];

/**
 * The colour a view gives a node, worked out from its status. Live work is green, what waits on its owner is
 * scarlet, a checkpoint is gold, a claim gone quiet is amber, and done recedes.
 */
export const NodeTone = Object.freeze({
  WAITING: 'waiting', READY: 'ready', LIVE: 'live', NEEDS_OWNER: 'needs-owner', STALE: 'stale', DONE: 'done',
  CHECKPOINT: 'checkpoint',
} as const);
export type NodeToneValue = typeof NodeTone[keyof typeof NodeTone];

export const AttachmentKind = Object.freeze({ IMAGE: 'image', VIDEO: 'video', PAGE: 'page', LINK: 'link' } as const);
export type AttachmentKindValue = typeof AttachmentKind[keyof typeof AttachmentKind];

/** A picture, a clip, a page to preview, or a link. A phone capture is drawn at a phone's width. */
export interface NodeAttachment {
  kind: AttachmentKindValue;
  src: string;
  caption?: string;
  phone?: boolean;
}

export interface ReplyOption {
  key: string;
  label: string;
  desc?: string;
}

/** The answers a question offers, when its asker set them; without options it takes Yes, No or a note. */
export interface NodeReplyOptions {
  options?: ReplyOption[];
  multi?: boolean;
  recommend?: string;
}

/** The owner's answer: a choice, a note, what they attached, and the revision of the question it answered. */
export interface NodeReply {
  choice?: string | string[] | null;
  note?: string;
  attachments?: NodeAttachment[];
  revision?: number;
}

export interface NodeLogEntry {
  at: number;
  verb: LogVerbValue;
  agent?: string;
  text?: string;
}

/** One seat's verdict on a checkpoint, on exactly the inputs it saw. */
export interface NodeReview {
  verdict: VerdictValue;
  inputs: string[];
  at: number;
  why?: string;
  model?: ReviewModelValue;
  by?: string;
}

export interface NodeWithdrawal {
  by: string;
  why: string;
  at: number;
}

/** A conversation settled the work; this records evidence without an owner answer or approval. */
export interface NodeResolution {
  by: string;
  at: number;
  reason: string;
  reference: string;
  excerpt: string;
}

/** Where a node stands, and its own log. */
export interface NodeStatus {
  state: NodeStateValue;
  log: NodeLogEntry[];
  claimedBy?: string;
  claimedAt?: number;
  /** The agent the owner handed this to, who should take it next. */
  assignedTo?: string;
  doneBy?: string;
  withdrawn?: NodeWithdrawal;
  resolved?: NodeResolution;
  phase?: LifecyclePhaseValue;
  reviews?: Partial<Record<ReviewerValue, NodeReview>>;
}

/**
 * What a node waits on, and the checkpoint a task feeds. A checkpoint's `after` lists the checkpoints it needs, none or
 * several, so independent checkpoints run alongside each other. The owner marks one checkpoint as the destination.
 */
export interface NodePath {
  after?: string[];
  for?: string;
  destination?: boolean;
}

/** An agent's proposal to move a checkpoint from one phase to another, which the owner answers. */
export interface NodeProposal {
  checkpoint: string;
  from: LifecyclePhaseValue;
  to: LifecyclePhaseValue;
}

/** Where a node is read from when it isn't the desk's own, and whether it can be answered there. */
export interface NodeSource {
  name: string;
  href?: string;
  anchor?: string;
  readonly?: boolean;
}

/** One node on a project's path. Its id starts with its source's prefix, as todo:… or checkpoint:…. `facts` are short
 * words beside its name, `table` a small table it shows, and `compare` captures shown side by side. */
export interface PathNode {
  id: string;
  kind: NodeKindValue;
  name: string;
  status: NodeStatus;
  description?: string;
  links?: NodeAttachment[];
  images?: NodeAttachment[];
  replyOptions?: NodeReplyOptions;
  reply?: NodeReply;
  path?: NodePath;
  proposal?: NodeProposal;
  source?: NodeSource;
  facts?: string[];
  table?: { head: string[]; rows: string[][] };
  compare?: NodeAttachment[];
  author?: string;
  revision?: number;
  at?: number;
}
