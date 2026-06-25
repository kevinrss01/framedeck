import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createGateway, Tool } from 'ai';
import type { ReportToolResultRequest, ReportToolResultResponse } from 'api-types';
import { editorToolNames } from 'api-types';
import { aiGatewayToolNames } from '../tool-names';
import { AudioService } from '../../audio/audio.service';
import { RealtimeService } from '../../realtime/realtime.service';
import { TwelveLabsService } from '../../video-analysis/twelve-labs/twelve-labs.service';
import type { ToolsContext, ToolDependencies, ActionToolDependencies } from './tool-creators';
import {
  // Plan tools
  createCreatePlanTool,
  createUpdatePlanTool,
  // Timeline tools
  createSelectTimelineItemsTool,
  createPlaceLibraryAssetsOnTimelineTool,
  createPlaceTimelineItemsTool,
  createDeleteItemsTool,
  createTrimTimelineItemsTool,
  createCutFrameRangeTool,
  createCutTimeRangesTool,
  // Library tools
  createGetLibraryAssetsDataTool,
  // Action tools
  createRemoveSilencesTool,
  createSetCaptionsTool,
  // Text tools
  createDelegateTextOverlayTaskTool,
  // Image tools
  createDelegateImagePictureTaskTool,
  // Shape tools
  createDelegateShapeOverlayTaskTool,
  // Motion design tools
  createDelegateMotionDesignTaskTool,
  // Transcription tools
  createGetTranscriptionTool,
  createInvestigateTranscriptionTool,
  // Footage analysis tools
  createAnalyzeFootageTool,
  // Data tools
  createGetProjectStateTool,
  createGetItemsDataTool,
} from './tool-creators';

@Injectable()
export class ToolsService {
  private readonly logger = new Logger(ToolsService.name);
  private pendingResults = new Map<
    string,
    {
      resolve: (result: ReportToolResultRequest | { status: 'timeout'; toolCallId: string }) => void;
      timeoutId: NodeJS.Timeout;
    }
  >();

  constructor(
    private readonly realtimeService: RealtimeService,
    private readonly audioService: AudioService,
    private readonly configService: ConfigService,
    private readonly twelveLabsService: TwelveLabsService,
  ) {}

  getTools(context?: ToolsContext): Record<string, Tool> {
    const deps = this.createToolDependencies();
    const actionDeps = this.createActionToolDependencies();

    return {
      [editorToolNames.delegateTextOverlayTask]: createDelegateTextOverlayTaskTool(deps, context),
      [editorToolNames.delegateImagePictureTask]: createDelegateImagePictureTaskTool(deps, context),
      [editorToolNames.delegateShapeOverlayTask]: createDelegateShapeOverlayTaskTool(deps, context),
      [editorToolNames.delegateMotionDesignTask]: createDelegateMotionDesignTaskTool(deps, context),
      // Timeline tools
      [editorToolNames.selectTimelineItems]: createSelectTimelineItemsTool(deps),
      [editorToolNames.placeLibraryAssetsOnTimeline]: createPlaceLibraryAssetsOnTimelineTool(deps, context),
      [editorToolNames.placeTimelineItems]: createPlaceTimelineItemsTool(deps, context),
      [editorToolNames.deleteItems]: createDeleteItemsTool(deps, context),
      [editorToolNames.trimTimelineItems]: createTrimTimelineItemsTool(deps, context),
      [editorToolNames.cutFrameRange]: createCutFrameRangeTool(deps, context),
      [aiGatewayToolNames.cutTimeRanges]: createCutTimeRangesTool(deps, context),
      // Library tools
      [editorToolNames.getLibraryAssetsData]: createGetLibraryAssetsDataTool(deps, context),
      // Action tools
      [editorToolNames.removeSilences]: createRemoveSilencesTool(actionDeps, context),
      [editorToolNames.setCaptions]: createSetCaptionsTool(deps, context),
      // Transcription tools
      [editorToolNames.getTranscription]: createGetTranscriptionTool(deps, context),
      [aiGatewayToolNames.investigateTranscription]: createInvestigateTranscriptionTool(deps, context),
      // Footage analysis tools
      [aiGatewayToolNames.analyzeFootage]: createAnalyzeFootageTool(deps),
      // Data tools
      [editorToolNames.getProjectState]: createGetProjectStateTool(deps, context),
      [editorToolNames.getItemsData]: createGetItemsDataTool(deps, context),
      // Plan tools
      [editorToolNames.createPlan]: createCreatePlanTool(),
      [editorToolNames.updatePlan]: createUpdatePlanTool(),
    };
  }

  registerToolResult(payload: ReportToolResultRequest): ReportToolResultResponse {
    const pending = this.pendingResults.get(payload.toolCallId);
    if (pending) {
      clearTimeout(pending.timeoutId);
      pending.resolve(payload);
      this.pendingResults.delete(payload.toolCallId);
    }

    return { status: 'received' };
  }

  private createToolDependencies(): ToolDependencies {
    const gateway = createGateway({
      apiKey: this.configService.getOrThrow<string>('AI_GATEWAY_API_KEY'),
    });

    return {
      realtimeService: this.realtimeService,
      waitForToolResult: this.waitForToolResult.bind(this),
      getLanguageModel: (modelId) => gateway(modelId),
      footageAnalyzer: {
        analyzeVideo: (args) => this.twelveLabsService.analyzeVideo(args),
      },
      logger: {
        log: this.logger.log.bind(this.logger),
        warn: this.logger.warn.bind(this.logger),
        debug: this.logger.debug.bind(this.logger),
      },
    };
  }

  private createActionToolDependencies(): ActionToolDependencies {
    return {
      ...this.createToolDependencies(),
      audioService: this.audioService,
      logger: {
        log: this.logger.log.bind(this.logger),
        warn: this.logger.warn.bind(this.logger),
        debug: this.logger.debug.bind(this.logger),
      },
    };
  }

  private waitForToolResult(toolCallId: string, timeoutMs = 10 * 60 * 1000) {
    return new Promise<ReportToolResultRequest | { status: 'timeout'; toolCallId: string }>((resolve) => {
      const timeoutId = setTimeout(() => {
        this.pendingResults.delete(toolCallId);
        resolve({ status: 'timeout', toolCallId });
      }, timeoutMs);

      this.pendingResults.set(toolCallId, { resolve, timeoutId });
    });
  }
}
