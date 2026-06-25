import type {
  CaptionEdit,
  CaptionStyleInput,
  DigestProjectStateRequest,
  ImageItemInput,
  ImageItemPatchInput,
  MotionDesignItemInput,
  MotionDesignItemPatchInput,
  MotionDesignEffectDefinition,
  MotionDesignSelectionBehavior,
  MotionDesignTemplate,
  MotionDesignTemplateWithAgentDescription,
  MotionDesignTimingCheck,
  RemoveSilencesDetectionMode,
  ReportToolResultRequest,
  ShapeItemInput,
  ShapeItemPatchInput,
  ShapeSelectionBehavior,
  TextItemInput,
  TextItemPatchInput,
  TextSelectionBehavior,
  TimelineTrimMode,
  TranscriptionWord,
  ChatMode,
  ChatStreamSubagentDebugEvent,
} from 'api-types';
import type { LanguageModel } from 'ai';
import type { RealtimeService } from '../../../realtime/realtime.service';
import type { AudioService } from '../../../audio/audio.service';

// ============================================
// Shared Context & Dependencies
// ============================================

export type ToolsContext = {
  projectState?: DigestProjectStateRequest;
  messageId?: string;
  modelId?: string;
  mode?: ChatMode;
  reportSubagentDebugEvent?: (event: ChatStreamSubagentDebugEvent) => void;
};

// Minimal structural contract for the TwelveLabs footage analyzer used by tools.
// Kept structural so tool-creators stay decoupled from the Nest service module.
export type FootageAnalyzer = {
  analyzeVideo: (args: { videoId?: string; videoUrl?: string; prompt: string }) => Promise<string>;
};

export type ToolDependencies = {
  realtimeService: RealtimeService;
  waitForToolResult: (
    toolCallId: string,
    timeoutMs?: number,
  ) => Promise<ReportToolResultRequest | { status: 'timeout'; toolCallId: string }>;
  getLanguageModel: (modelId: string) => LanguageModel;
  footageAnalyzer?: FootageAnalyzer;
  logger?: {
    log: (message: string, ...args: unknown[]) => void;
    warn: (message: string, ...args: unknown[]) => void;
    debug: (message: string, ...args: unknown[]) => void;
  };
};

export type ActionToolDependencies = ToolDependencies & {
  audioService: AudioService;
  logger: {
    log: (message: string, ...args: unknown[]) => void;
    warn: (message: string, ...args: unknown[]) => void;
    debug: (message: string, ...args: unknown[]) => void;
  };
};

// ============================================
// Timeline Tools Types
// ============================================

export type SelectTimelineItemsInput = { itemIds: string[]; reason?: string };
export type SelectTimelineItemsResult = {
  status: 'dispatched' | 'skipped';
  requestedItemIds: string[];
  note?: string;
};

export type PlaceLibraryAssetsOnTimelineInput = {
  libraryAssetIds: string[];
  trackId?: string;
  startFrame?: number;
  startTimeInSeconds?: number;
  afterItemId?: string;
  reason?: string;
};

export type PlaceLibraryAssetsOnTimelineResult = {
  status: 'completed' | 'skipped' | 'timeout' | 'error';
  requestedLibraryAssetIds: string[];
  placed?: {
    assetId: string;
    itemId: string;
    trackId: string;
    startFrame: number;
    endFrame: number;
    startTimeInSeconds: number;
    endTimeInSeconds: number;
  }[];
  skippedAssetIds?: string[];
  note?: string;
  error?: string;
  projectState?: Record<string, unknown>;
};

export type PlaceTimelineItemsInput = {
  itemIds: string[];
  trackId?: string;
  startFrame?: number;
  startTimeInSeconds?: number;
  afterItemId?: string;
  reason?: string;
};

export type PlaceTimelineItemsResult = {
  status: 'completed' | 'skipped' | 'timeout' | 'error';
  requestedItemIds: string[];
  placed?: {
    itemId: string;
    trackId: string;
    startFrame: number;
    endFrame: number;
    startTimeInSeconds: number;
    endTimeInSeconds: number;
  }[];
  skippedItemIds?: string[];
  note?: string;
  error?: string;
  projectState?: Record<string, unknown>;
};

export type DeleteItemsInput = { itemIds: string[]; reason?: string };
export type DeleteItemsResult = {
  status: 'completed' | 'skipped' | 'timeout' | 'error';
  requestedItemIds: string[];
  deletedItemIds?: string[];
  note?: string;
  error?: string;
  projectState?: Record<string, unknown>;
};

export type TrimTimelineItemsInput = {
  itemIds: string[];
  mode?: TimelineTrimMode;
  durationInFrames?: number;
  durationInSeconds?: number;
  reason?: string;
};

export type TrimTimelineItemsResult = {
  status: 'completed' | 'skipped' | 'timeout' | 'error';
  requestedItemIds: string[];
  mode: TimelineTrimMode;
  trimmedItems?: {
    sourceItemId: string;
    itemId: string;
    trackId: string;
    startFrame: number;
    endFrame: number;
    startTimeInSeconds: number;
    endTimeInSeconds: number;
    removedFrames: number;
  }[];
  skippedItemIds?: string[];
  note?: string;
  error?: string;
  projectState?: Record<string, unknown>;
};

export type FrameRangeInput = { startFrame: number; endFrame: number };
export type CutFrameRangeInput = { trackId: string; ranges: FrameRangeInput[]; reason?: string };
export type CutFrameRangeResult = {
  status: 'completed' | 'skipped' | 'timeout' | 'error';
  trackId: string;
  ranges: FrameRangeInput[];
  removedFrames?: number;
  note?: string;
  error?: string;
  projectState?: Record<string, unknown>;
};

export type TimeRangeInput = { startTimeInSeconds: number; endTimeInSeconds: number };
export type CutTimeRangesInput = { trackId: string; ranges: TimeRangeInput[]; reason?: string };
export type CutTimeRangesResult = {
  status: 'completed' | 'skipped' | 'timeout' | 'error';
  trackId: string;
  ranges: TimeRangeInput[];
  appliedFrameRanges?: FrameRangeInput[];
  removedFrames?: number;
  removedSeconds?: number;
  note?: string;
  error?: string;
  projectState?: Record<string, unknown>;
};

// ============================================
// Query Tools Types
// ============================================

export type GetProjectStateInput = { reason?: string };
export type GetProjectStateResult = {
  status: 'completed' | 'timeout' | 'error';
  data?: Record<string, unknown>;
  note?: string;
  error?: string;
};

export type GetItemsDataInput = { itemIds: string[]; reason?: string };
export type GetItemsDataResult = {
  status: 'completed' | 'skipped' | 'timeout' | 'error';
  requestedItemIds: string[];
  data?: Record<string, unknown>;
  note?: string;
  error?: string;
};

export type GetLibraryAssetsDataInput = { reason?: string };
export type GetLibraryAssetsDataResult = string;

export type GetTranscriptionInput = { itemIds?: string[]; reason?: string };
export type GetTranscriptionResult = {
  status: 'completed' | 'skipped' | 'timeout' | 'error';
  targetItemIds?: string[];
  wordCount?: number;
  itemCount?: number;
  totalMinutes?: number;
  generalization?: string;
  note?: string;
  error?: string;
};

export type GetDetailedTranscriptionInput = { minutes: number[]; itemIds?: string[]; reason?: string };
export type GetDetailedTranscriptionResult = {
  status: 'completed' | 'skipped' | 'timeout' | 'error';
  minutes: number[];
  targetItemIds?: string[];
  wordCount?: number;
  note?: string;
  error?: string;
  transcription?: TranscriptionWord[];
  generalization?: string;
};

export type InvestigateTranscriptionInput = {
  prompt: string;
  itemIds?: string[];
  minutes?: number[];
  videoContext?: string;
  reason?: string;
};

export type InvestigateTranscriptionFinding = {
  label?: string;
  startTimeInSeconds?: number;
  endTimeInSeconds?: number;
  confidence?: number;
  reason?: string;
};

export type InvestigateTranscriptionResult = {
  status: 'running' | 'completed' | 'timeout' | 'error';
  answer?: string;
  generalization?: string;
  findings?: InvestigateTranscriptionFinding[];
  targetItemIds?: string[];
  minutes?: number[];
  modelId?: string;
  fallbackUsed?: boolean;
  note?: string;
  error?: string;
};

export type AnalyzeFootageInput = {
  prompt: string;
  videoId: string;
  reason?: string;
};

export type AnalyzeFootageResult = {
  status: 'completed' | 'skipped' | 'error';
  videoId?: string;
  answer?: string;
  note?: string;
  error?: string;
};

// ============================================
// Editing Tools Types
// ============================================

export type RemoveSilencesInput = {
  itemId?: string;
  itemIds?: string[];
  noiseThresholdInDecibels?: number;
  minDurationInSeconds?: number;
  paddingInSeconds?: number;
  detectionMode?: RemoveSilencesDetectionMode;
  reason?: string;
};

export type RemoveSilencesResult = {
  status: 'completed' | 'skipped' | 'timeout' | 'error';
  targetItemId?: string;
  targetItemIds?: string[];
  note?: string;
  output?: Record<string, unknown>;
  error?: string;
  projectState?: Record<string, unknown>;
};

export type SetCaptionsInput = {
  itemIds?: string[];
  replaceExisting?: boolean;
  style?: CaptionStyleInput;
  captionEdits?: CaptionEdit[];
  reason?: string;
};

export type SetCaptionsResult = {
  status: 'completed' | 'skipped' | 'timeout' | 'error';
  targetItemIds?: string[];
  note?: string;
  output?: Record<string, unknown>;
  error?: string;
  projectState?: Record<string, unknown>;
};

export type AddTextItemsInput = {
  items: TextItemInput[];
  reason?: string;
};

export type AddTextItemsResult = {
  status: 'completed' | 'skipped' | 'timeout' | 'error';
  requestedCount: number;
  createdItems?: {
    itemId: string;
    text: string;
    trackId: string;
    startFrame: number;
    endFrame: number;
    startTimeInSeconds: number;
    endTimeInSeconds: number;
  }[];
  note?: string;
  error?: string;
  projectState?: Record<string, unknown>;
};

export type TextToolStatus = 'success' | 'partial_success' | 'needs_clarification' | 'error';

export type TextTaskTimeRange = {
  startTimeInSeconds?: number;
  endTimeInSeconds?: number;
  startFrame?: number;
  endFrame?: number;
};

export type DelegateTextOverlayTaskInput = {
  task: string;
  projectId: string;
  targetItemIds?: string[];
  timeRange?: TextTaskTimeRange;
  reason?: string;
};

export type DelegateTextOverlayTaskResult = {
  status: TextToolStatus;
  createdItemIds: string[];
  updatedItemIds: string[];
  deletedItemIds: string[];
  selectedItemIds: string[];
  summary: string;
  unresolvedIssue?: string;
};

export type UpdateTextItemsInput = {
  itemIds: string[];
  patch: TextItemPatchInput;
  selectionBehavior?: TextSelectionBehavior;
  reason?: string;
};

export type UpdateTextItemsResult = {
  status: 'completed' | 'skipped' | 'timeout' | 'error';
  requestedItemIds: string[];
  updatedItems?: {
    itemId: string;
    text: string;
    startFrame: number;
    endFrame: number;
    startTimeInSeconds: number;
    endTimeInSeconds: number;
  }[];
  updatedItemIds?: string[];
  selectedItemIds?: string[];
  failedItems?: { itemId: string; error: string }[];
  note?: string;
  error?: string;
  projectState?: Record<string, unknown>;
};

export type ImageToolStatus = 'success' | 'partial_success' | 'needs_clarification' | 'error';

export type ImageTaskTimeRange = {
  startTimeInSeconds?: number;
  endTimeInSeconds?: number;
  startFrame?: number;
  endFrame?: number;
};

export type DelegateImagePictureTaskInput = {
  task: string;
  projectId: string;
  targetItemIds?: string[];
  targetAssetIds?: string[];
  timeRange?: ImageTaskTimeRange;
  reason?: string;
};

export type DelegateImagePictureTaskResult = {
  status: ImageToolStatus;
  createdItemIds: string[];
  updatedItemIds: string[];
  deletedItemIds: string[];
  selectedItemIds: string[];
  usedAssetIds: string[];
  summary: string;
  unresolvedIssue?: string;
};

export type AddImageItemsInput = {
  items: ImageItemInput[];
  reason?: string;
};

export type AddImageItemsResult = {
  status: 'completed' | 'skipped' | 'timeout' | 'error';
  requestedAssetIds: string[];
  createdItems?: {
    assetId: string;
    itemId: string;
    trackId: string;
    startFrame: number;
    endFrame: number;
    startTimeInSeconds: number;
    endTimeInSeconds: number;
  }[];
  skippedAssetIds?: string[];
  note?: string;
  error?: string;
  projectState?: Record<string, unknown>;
};

export type UpdateImageItemsInput = {
  itemIds: string[];
  patch: ImageItemPatchInput;
  selectionBehavior?: 'select_updated' | 'keep_current' | 'none';
  reason?: string;
};

export type UpdateImageItemsResult = {
  status: 'completed' | 'skipped' | 'timeout' | 'error';
  requestedItemIds: string[];
  updatedItemIds?: string[];
  selectedItemIds?: string[];
  usedAssetIds?: string[];
  itemErrors?: { itemId: string; error: string }[];
  note?: string;
  error?: string;
  projectState?: Record<string, unknown>;
};

export type ShapeToolStatus = 'success' | 'partial_success' | 'needs_clarification' | 'error';

export type ShapeTaskTimeRange = {
  startTimeInSeconds?: number;
  endTimeInSeconds?: number;
  startFrame?: number;
  endFrame?: number;
};

export type DelegateShapeOverlayTaskInput = {
  task: string;
  projectId: string;
  targetItemIds?: string[];
  timeRange?: ShapeTaskTimeRange;
  reason?: string;
};

export type DelegateShapeOverlayTaskResult = {
  status: ShapeToolStatus;
  createdItemIds: string[];
  updatedItemIds: string[];
  deletedItemIds: string[];
  selectedItemIds: string[];
  summary: string;
  unresolvedIssue?: string;
};

export type AddShapeItemsInput = {
  items: ShapeItemInput[];
  reason?: string;
};

export type AddShapeItemsResult = {
  status: 'completed' | 'skipped' | 'timeout' | 'error';
  requestedCount: number;
  createdItems?: {
    itemId: string;
    shapeKind: string;
    trackId: string;
    startFrame: number;
    endFrame: number;
    startTimeInSeconds: number;
    endTimeInSeconds: number;
  }[];
  createdItemIds?: string[];
  selectedItemIds?: string[];
  note?: string;
  error?: string;
  projectState?: Record<string, unknown>;
};

export type UpdateShapeItemsInput = {
  itemIds: string[];
  patch: ShapeItemPatchInput;
  selectionBehavior?: ShapeSelectionBehavior;
  reason?: string;
};

export type UpdateShapeItemsResult = {
  status: 'completed' | 'skipped' | 'timeout' | 'error';
  requestedItemIds: string[];
  updatedItems?: {
    itemId: string;
    shapeKind?: string;
    startFrame: number;
    endFrame: number;
    startTimeInSeconds: number;
    endTimeInSeconds: number;
  }[];
  updatedItemIds?: string[];
  selectedItemIds?: string[];
  failedItems?: { itemId: string; error: string }[];
  note?: string;
  error?: string;
  projectState?: Record<string, unknown>;
};

export type MotionDesignToolStatus = 'success' | 'partial_success' | 'needs_clarification' | 'error';

export type MotionDesignTaskTimeRange = {
  startTimeInSeconds?: number;
  endTimeInSeconds?: number;
  startFrame?: number;
  endFrame?: number;
};

export type DelegateMotionDesignTaskInput = {
  task: string;
  projectId: string;
  targetItemIds?: string[];
  timeRange?: MotionDesignTaskTimeRange;
  reason?: string;
};

export type DelegateMotionDesignTaskResult = {
  status: MotionDesignToolStatus;
  createdItemIds: string[];
  updatedItemIds: string[];
  deletedItemIds: string[];
  selectedItemIds: string[];
  usedTemplateIds: string[];
  summary: string;
  unresolvedIssue?: string;
};

export type GetMotionDesignTemplatesInput = {
  category?: MotionDesignTemplate['category'];
  search?: string;
  reason?: string;
};

export type GetMotionDesignTemplatesResult = {
  status: 'completed';
  templates: MotionDesignTemplateWithAgentDescription[];
  count: number;
};

export type GetMotionDesignPresetDetailsInput = {
  templateId: string;
  reason?: string;
};

export type GetMotionDesignPresetDetailsResult = {
  status: 'completed' | 'error';
  templateId: string;
  template?: MotionDesignTemplateWithAgentDescription;
  supportedPropKeys?: string[];
  effects?: MotionDesignEffectDefinition[];
  tips?: string[];
  error?: string;
};

export type AddMotionDesignItemsInput = {
  items: MotionDesignItemInput[];
  reason?: string;
};

export type AddMotionDesignItemsResult = {
  status: 'completed' | 'skipped' | 'timeout' | 'error';
  requestedCount: number;
  createdItems?: {
    itemId: string;
    templateId: string;
    startFrame: number;
    endFrame: number;
    startTimeInSeconds: number;
    endTimeInSeconds: number;
  }[];
  createdItemIds?: string[];
  selectedItemIds?: string[];
  animationCheck?: MotionDesignTimingCheck[];
  changedFields?: string[];
  rejectedProps?: string[];
  note?: string;
  error?: string;
  projectState?: Record<string, unknown>;
};

export type UpdateMotionDesignItemsInput = {
  itemIds: string[];
  patch: MotionDesignItemPatchInput;
  selectionBehavior?: MotionDesignSelectionBehavior;
  reason?: string;
};

export type UpdateMotionDesignItemsResult = {
  status: 'completed' | 'skipped' | 'timeout' | 'error';
  requestedItemIds: string[];
  updatedItems?: {
    itemId: string;
    templateId: string;
    startFrame: number;
    endFrame: number;
    startTimeInSeconds: number;
    endTimeInSeconds: number;
  }[];
  updatedItemIds?: string[];
  selectedItemIds?: string[];
  failedItems?: { itemId: string; error: string }[];
  animationCheck?: MotionDesignTimingCheck[];
  changedFields?: string[];
  rejectedProps?: string[];
  note?: string;
  error?: string;
  projectState?: Record<string, unknown>;
};

// ============================================
// Plan Tools Types
// ============================================

export type CreatePlanInput = { title: string; steps: { id: string; title: string }[]; reason?: string };
export type CreatePlanResult = { status: 'success'; note: string };

export type UpdatePlanInput = {
  stepId: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  description?: string;
  reason?: string;
};
export type UpdatePlanResult = { status: 'success'; note: string };
