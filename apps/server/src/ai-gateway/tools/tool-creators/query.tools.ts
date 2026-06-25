import { Tool } from 'ai';
import type {
  EditorRealtimePayload,
  EditorGetItemsDataPayload,
  EditorGetLibraryAssetsDataPayload,
  EditorGetTranscriptionPayload,
  EditorGetDetailedTranscriptionPayload,
  TranscriptionWord,
} from 'api-types';
import { editorToolNames, realtimeMessageTypes } from 'api-types';
import { z } from 'zod';
import {
  stripUrlsFromProjectState,
  buildTranscriptionGeneralization,
  mapToolResultStatus,
  extractErrorDetail,
} from './utils';
import type {
  ToolsContext,
  ToolDependencies,
  GetProjectStateInput,
  GetProjectStateResult,
  GetItemsDataInput,
  GetItemsDataResult,
  GetLibraryAssetsDataInput,
  GetLibraryAssetsDataResult,
  GetTranscriptionInput,
  GetTranscriptionResult,
  GetDetailedTranscriptionInput,
  GetDetailedTranscriptionResult,
} from './types';

function buildTranscriptionStatusModelOutput(output: GetTranscriptionResult) {
  const detailParts = [
    output.itemCount ? `${output.itemCount} item(s)` : undefined,
    output.wordCount ? `${output.wordCount} words` : undefined,
    output.totalMinutes ? `${output.totalMinutes} minute(s)` : undefined,
  ].filter(Boolean);

  const detailSuffix = detailParts.length > 0 ? ` (${detailParts.join(', ')})` : '';
  return {
    type: 'text' as const,
    value:
      output.status === 'completed'
        ? JSON.stringify({
            status: output.status,
            message: `Transcription prepared successfully${detailSuffix}.`,
            wordCount: output.wordCount,
            itemCount: output.itemCount,
            totalMinutes: output.totalMinutes,
            targetItemIds: output.targetItemIds,
            generalization: output.generalization,
          })
        : (output.note ?? output.error ?? 'Transcription request failed.'),
  };
}

export function createGetProjectStateTool(
  deps: ToolDependencies,
  context?: ToolsContext,
): Tool<GetProjectStateInput, GetProjectStateResult> {
  const description = [
    'Request the current project state from the editor in real-time.',
    "No need to call this tool if you already have the project state in your context AND you didn't perform any operations that require accurate current state.",
    'Use this to get fresh, up-to-date information about tracks, items, dimensions, and selection.',
    'Response contains tracksInfo, dimensionsInfo, projectItemsInfo, selectedItemsInfo, fpsInfo, duration/playhead, and overlay summaries.',
  ].join(' ');

  return {
    description,
    inputSchema: z.object({ reason: z.string().trim().max(200).optional() }),
    execute: async ({ reason }: GetProjectStateInput, { toolCallId }: { toolCallId?: string }) => {
      const resolvedToolCallId = toolCallId ?? `get-project-state-${Date.now()}`;
      const waitForResult = deps.waitForToolResult(resolvedToolCallId);

      deps.realtimeService.dispatchMessage({
        type: realtimeMessageTypes.editor,
        payload: {
          tool_name: editorToolNames.getProjectState,
          params: {} as Record<string, never>,
          toolCallId: resolvedToolCallId,
          messageId: context?.messageId,
          requestedAt: new Date().toISOString(),
        } satisfies EditorRealtimePayload,
        timestamp: new Date().toISOString(),
      });

      const result = await waitForResult;
      if ('status' in result && result.status === 'timeout') {
        return {
          status: 'timeout',
          note: 'No response received from editor after requesting project state.',
        };
      }

      const mappedStatus = mapToolResultStatus(result.status, {
        success: 'completed' as const,
        error: 'error' as const,
      });
      const errorDetail = extractErrorDetail(result);

      if (mappedStatus === 'error') {
        return {
          status: 'error',
          note: errorDetail ?? 'Failed to retrieve project state.',
          error: errorDetail,
        };
      }

      deps.logger?.debug('Project state retrieved successfully.');
      return {
        status: 'completed',
        data: stripUrlsFromProjectState(result.output ?? {}),
        note: reason ?? 'Project state retrieved successfully.',
      };
    },
  } as unknown as Tool<GetProjectStateInput, GetProjectStateResult>;
}

export function createGetItemsDataTool(
  deps: ToolDependencies,
  context?: ToolsContext,
): Tool<GetItemsDataInput, GetItemsDataResult> {
  const description = [
    'Retrieve detailed data for one or many timeline items by their IDs.',
    'Returns comprehensive item information including position, dimensions, duration, and type-specific properties.',
    'For caption items: includes font settings, colors, stroke, highlight, and full captions array.',
    'For video/audio items: includes playbackRate, decibelAdjustment, fade settings.',
  ].join(' ');

  return {
    description,
    inputSchema: z.object({
      itemIds: z.array(z.string().trim().min(1)).nonempty('Provide at least one item ID'),
      reason: z.string().trim().max(200).optional(),
    }),
    execute: async ({ itemIds, reason }: GetItemsDataInput, { toolCallId }: { toolCallId?: string }) => {
      const normalizedIds = Array.from(new Set(itemIds.map((id) => id.trim()).filter((id) => id.length > 0)));
      if (normalizedIds.length === 0) {
        return { status: 'skipped', requestedItemIds: [], note: 'No valid item IDs provided.' };
      }

      const resolvedToolCallId = toolCallId ?? `get-items-data-${Date.now()}`;
      const waitForResult = deps.waitForToolResult(resolvedToolCallId);
      const params: EditorGetItemsDataPayload['params'] = { itemIds: normalizedIds };

      deps.realtimeService.dispatchMessage({
        type: realtimeMessageTypes.editor,
        payload: {
          tool_name: editorToolNames.getItemsData,
          params,
          toolCallId: resolvedToolCallId,
          messageId: context?.messageId,
          requestedAt: new Date().toISOString(),
        },
        timestamp: new Date().toISOString(),
      });

      const result = await waitForResult;
      if ('status' in result && result.status === 'timeout') {
        return {
          status: 'timeout',
          requestedItemIds: normalizedIds,
          note: 'No response received from editor.',
        };
      }

      const mappedStatus = mapToolResultStatus(result.status, {
        success: 'completed' as const,
        skipped: 'skipped' as const,
        error: 'error' as const,
      });
      const errorDetail = extractErrorDetail(result);

      if (mappedStatus === 'error') {
        return {
          status: 'error',
          requestedItemIds: normalizedIds,
          note: errorDetail ?? 'Failed to retrieve items data.',
          error: errorDetail,
        };
      }

      return {
        status: mappedStatus,
        requestedItemIds: normalizedIds,
        data: stripUrlsFromProjectState(result.output ?? {}),
        note: reason ?? `Retrieved data for ${normalizedIds.length} item(s).`,
      };
    },
  } as unknown as Tool<GetItemsDataInput, GetItemsDataResult>;
}

export function createGetLibraryAssetsDataTool(
  deps: ToolDependencies,
  context?: ToolsContext,
): Tool<GetLibraryAssetsDataInput, GetLibraryAssetsDataResult> {
  const description = [
    'This tool gives you all informations about all assets in the library.',
    'Returns a Markdown summary with name, type, duration, and available video analysis.',
    'Use this before planning edits that rely on library footage.',
  ].join(' ');

  return {
    description,
    inputSchema: z.object({ reason: z.string().trim().max(200).optional() }),
    execute: async ({ reason }: GetLibraryAssetsDataInput, { toolCallId }: { toolCallId?: string }) => {
      const resolvedToolCallId = toolCallId ?? `get-library-assets-data-${Date.now()}`;
      const waitForResult = deps.waitForToolResult(resolvedToolCallId);

      deps.realtimeService.dispatchMessage({
        type: realtimeMessageTypes.editor,
        payload: {
          tool_name: editorToolNames.getLibraryAssetsData,
          params: {} as Record<string, never>,
          toolCallId: resolvedToolCallId,
          messageId: context?.messageId,
          requestedAt: new Date().toISOString(),
        } satisfies EditorGetLibraryAssetsDataPayload,
        timestamp: new Date().toISOString(),
      });

      const result = await waitForResult;
      if ('status' in result && result.status === 'timeout') return 'Library assets data request timed out.';
      if (result.status !== 'success') {
        const errorDetail = extractErrorDetail(result) ?? 'Failed to retrieve library assets data.';
        return `Failed to retrieve library assets data: ${errorDetail}`;
      }

      const assets = Array.isArray(result.output?.libraryAssets)
        ? (result.output.libraryAssets as Record<string, unknown>[])
        : [];
      const lines: string[] = [`# Library Assets (${assets.length})`];
      if (reason) lines.push(`_Reason: ${reason}_`);
      lines.push('');

      assets.forEach((asset, index) => {
        const assetId = typeof asset.assetId === 'string' ? asset.assetId : 'unknown';
        const fileName = typeof asset.fileName === 'string' ? asset.fileName : 'unknown';
        const fileType = typeof asset.fileType === 'string' ? asset.fileType : 'unknown';
        const status = typeof asset.status === 'string' ? asset.status : undefined;
        const duration =
          typeof asset.durationInSeconds === 'number' ? `${asset.durationInSeconds.toFixed(2)}s` : 'unknown';

        lines.push(
          `## ${index + 1}. ${fileName}`,
          `- assetId: ${assetId}`,
          `- type: ${fileType}`,
          `- duration: ${duration}`,
        );
        if (status) lines.push(`- status: ${status}`);

        const twelveLabs = asset.twelveLabs as Record<string, unknown> | undefined;
        if (twelveLabs && typeof twelveLabs.videoId === 'string' && twelveLabs.videoId.length > 0) {
          lines.push(
            `- twelveLabsVideoId: ${twelveLabs.videoId} (pass to analyze_footage for visual questions)`,
          );
        }

        const summary = asset.summary as Record<string, unknown> | undefined;
        const summaryError = typeof asset.summaryError === 'string' ? asset.summaryError.trim() : undefined;

        if (summary && typeof summary === 'object') {
          lines.push('', '**Video Analysis**');
          for (const key of ['macroView', 'causalLogic', 'sequentialSummary', 'socket', 'plug']) {
            const val = typeof summary[key] === 'string' ? summary[key].trim() : '';
            if (val) lines.push(`- ${key}: ${val}`);
          }
        } else if (summaryError) {
          lines.push('', `**Video Analysis Error**: ${summaryError}`);
        } else if (fileType === 'video') {
          lines.push('', '**Video Analysis**: not available yet.');
        }
        lines.push('');
      });

      return lines.join('\n').trim();
    },
  } as unknown as Tool<GetLibraryAssetsDataInput, GetLibraryAssetsDataResult>;
}

export function createGetTranscriptionTool(
  deps: ToolDependencies,
  context?: ToolsContext,
): Tool<GetTranscriptionInput, GetTranscriptionResult> {
  const description = [
    'Prepare transcription for timeline audio items.',
    'This keeps the transcription available in the editor timeline but does NOT return the transcript text to the main agent.',
    'MODES: (1) No itemIds = transcribe ALL audio items on timeline, (2) Single/multiple itemIds = transcribe those items.',
    'Use this first to learn totalMinutes before chunking get_detailed_transcription requests.',
    'For transcript-heavy analysis such as bad takes, quote search, or repeated attempts, use investigate_transcription.',
  ].join(' ');

  return {
    description,
    inputSchema: z.object({
      itemIds: z.array(z.string().trim().min(1)).optional(),
      reason: z.string().trim().max(200).optional(),
    }),
    execute: async ({ itemIds, reason }: GetTranscriptionInput, { toolCallId }: { toolCallId?: string }) => {
      const resolvedToolCallId = toolCallId ?? `get-transcription-${Date.now()}`;
      const waitForResult = deps.waitForToolResult(resolvedToolCallId);
      const normalizedItemIds = itemIds
        ? Array.from(new Set(itemIds.map((id) => id.trim()).filter((id) => id.length > 0)))
        : undefined;
      const params: EditorGetTranscriptionPayload['params'] = {
        itemIds: normalizedItemIds?.length ? normalizedItemIds : undefined,
      };

      deps.realtimeService.dispatchMessage({
        type: realtimeMessageTypes.editor,
        payload: {
          tool_name: editorToolNames.getTranscription,
          params,
          toolCallId: resolvedToolCallId,
          messageId: context?.messageId,
          requestedAt: new Date().toISOString(),
        },
        timestamp: new Date().toISOString(),
      });

      const result = await waitForResult;
      if ('status' in result && result.status === 'timeout') {
        return {
          status: 'timeout',
          targetItemIds: params.itemIds,
          note: 'No response received from editor.',
        };
      }

      const mappedStatus = mapToolResultStatus(result.status, {
        success: 'completed' as const,
        skipped: 'skipped' as const,
        error: 'error' as const,
      });
      const errorDetail = extractErrorDetail(result);

      if (mappedStatus === 'error') {
        return {
          status: 'error',
          targetItemIds: params.itemIds,
          note: errorDetail ?? 'Failed to get transcription.',
          error: errorDetail,
        };
      }

      const outputData = result.output ?? {};
      const words = outputData.words as TranscriptionWord[] | undefined;
      const fps = typeof outputData.fps === 'number' ? outputData.fps : 30;
      const { generalization, totalMinutes } = buildTranscriptionGeneralization({
        words: words ?? [],
        fps,
      });

      return {
        status: mappedStatus,
        targetItemIds: (outputData.targetItemIds as string[]) ?? params.itemIds,
        wordCount: typeof outputData.wordCount === 'number' ? outputData.wordCount : undefined,
        itemCount: typeof outputData.itemCount === 'number' ? outputData.itemCount : undefined,
        totalMinutes,
        generalization,
        note: reason ?? 'Transcription prepared successfully in the timeline.',
      };
    },
    toModelOutput: ({ output }: { output: GetTranscriptionResult }) =>
      buildTranscriptionStatusModelOutput(output),
  } as unknown as Tool<GetTranscriptionInput, GetTranscriptionResult>;
}

export function createGetDetailedTranscriptionTool(
  deps: ToolDependencies,
  context?: ToolsContext,
): Tool<GetDetailedTranscriptionInput, GetDetailedTranscriptionResult> {
  const description = [
    'Get DETAILED word-level transcription for specific minutes.',
    'Returns an array of words with precise timing (startFrame, endFrame) and trackId.',
    'INPUT: minutes array is required, 1-indexed (minute 1, minute 2, etc.), and limited to 10 minutes per call.',
    'For a 20-minute video, call this tool twice, for example minutes 1-10 then minutes 11-20.',
    'Use get_transcription first when you need the total duration before splitting the request.',
    'This is intended for private, transcript-heavy analysis flows.',
    'The subagent role is only to get the detailed transcription it cannot perform any other actions.',
  ].join(' ');

  return {
    description,
    inputSchema: z.object({
      minutes: z
        .array(z.number().int().min(1))
        .nonempty('Provide at least one minute')
        .max(10, 'You can request at most 10 minutes per call'),
      itemIds: z.array(z.string().trim().min(1)).optional(),
      reason: z.string().trim().max(200).optional(),
    }),
    execute: async (
      { minutes, itemIds, reason }: GetDetailedTranscriptionInput,
      { toolCallId }: { toolCallId?: string },
    ) => {
      const resolvedToolCallId = toolCallId ?? `get-detailed-transcription-${Date.now()}`;
      const normalizedMinutes = Array.from(new Set(minutes.filter((minute) => minute >= 1))).sort(
        (a, b) => a - b,
      );

      if (normalizedMinutes.length === 0) {
        return {
          status: 'skipped',
          minutes: [],
          note: 'Provide at least one minute for detailed transcription.',
        };
      }

      if (normalizedMinutes.length > 10) {
        return {
          status: 'skipped',
          minutes: normalizedMinutes,
          note: 'Detailed transcription is limited to 10 minutes per call. Split longer requests into multiple calls.',
        };
      }

      const waitForResult = deps.waitForToolResult(resolvedToolCallId);
      const normalizedItemIds = itemIds
        ? Array.from(new Set(itemIds.map((id) => id.trim()).filter((id) => id.length > 0)))
        : undefined;
      const params: EditorGetDetailedTranscriptionPayload['params'] = {
        minutes: normalizedMinutes.map((minute) => minute - 1),
        itemIds: normalizedItemIds?.length ? normalizedItemIds : undefined,
      };

      deps.realtimeService.dispatchMessage({
        type: realtimeMessageTypes.editor,
        payload: {
          tool_name: editorToolNames.getDetailedTranscription,
          params,
          toolCallId: resolvedToolCallId,
          messageId: context?.messageId,
          requestedAt: new Date().toISOString(),
        },
        timestamp: new Date().toISOString(),
      });

      const result = await waitForResult;
      if ('status' in result && result.status === 'timeout') {
        return {
          status: 'timeout',
          minutes: normalizedMinutes,
          targetItemIds: params.itemIds,
          note: 'No response received from editor.',
        };
      }

      const mappedStatus = mapToolResultStatus(result.status, {
        success: 'completed' as const,
        skipped: 'skipped' as const,
        error: 'error' as const,
      });
      const errorDetail = extractErrorDetail(result);

      if (mappedStatus === 'error') {
        return {
          status: 'error',
          minutes: normalizedMinutes,
          targetItemIds: params.itemIds,
          note: errorDetail ?? 'Failed to get detailed transcription.',
          error: errorDetail,
        };
      }

      const outputData = result.output ?? {};
      const note = `Retrieved ${outputData.wordCount ?? 'unknown'} words for minute(s): ${normalizedMinutes.join(', ')}.`;
      const transcription = outputData.words as TranscriptionWord[] | undefined;
      const fps = typeof outputData.fps === 'number' ? outputData.fps : 30;
      const { generalization } = buildTranscriptionGeneralization({
        words: transcription ?? [],
        fps,
        maxCharacters: 6000,
      });

      return {
        status: mappedStatus,
        minutes: normalizedMinutes,
        targetItemIds: (outputData.targetItemIds as string[]) ?? params.itemIds,
        wordCount: typeof outputData.wordCount === 'number' ? outputData.wordCount : undefined,
        transcription,
        generalization,
        note: reason ?? note,
      };
    },
  } as unknown as Tool<GetDetailedTranscriptionInput, GetDetailedTranscriptionResult>;
}
