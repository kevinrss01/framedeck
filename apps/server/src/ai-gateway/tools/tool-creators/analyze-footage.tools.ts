import { Tool } from 'ai';
import { z } from 'zod';
import type { AnalyzeFootageInput, AnalyzeFootageResult, ToolDependencies } from './types';

const MAX_ANSWER_CHARACTERS = 6000;

function buildAnalyzeFootageModelOutput(output: AnalyzeFootageResult) {
  if (output.status !== 'completed') {
    return {
      type: 'text' as const,
      value: output.note ?? output.error ?? 'Footage analysis failed.',
    };
  }

  return {
    type: 'text' as const,
    value: JSON.stringify({ videoId: output.videoId, answer: output.answer }),
  };
}

/**
 * Ask TwelveLabs Pegasus a natural-language question about already-indexed footage.
 *
 * Uploaded videos are indexed in TwelveLabs (videoId stored on the library asset as
 * `twelveLabs.videoId`). The library summary is a one-shot description captured at upload;
 * this tool lets the agent run a fresh, focused visual question against the footage at
 * edit time, for example locating b-roll, describing on-screen action, or finding the
 * clip that matches a prompt before planning timeline edits.
 */
export function createAnalyzeFootageTool(
  deps: ToolDependencies,
): Tool<AnalyzeFootageInput, AnalyzeFootageResult> {
  const description = [
    'Ask a natural-language question about the VISUAL content of an indexed video using TwelveLabs Pegasus.',
    'Use this for what is on screen: scenes, objects, people, actions, locations, on-screen text, or finding a moment that matches a description.',
    'Provide the videoId from a library asset (the `twelveLabs.videoId` returned by get_library_assets_data); the asset must be analyzed/indexed.',
    'For spoken words, quotes, or transcript-heavy analysis use investigate_transcription instead.',
    'Be specific about what you need back, such as a description, a yes/no, or approximate timestamps.',
  ].join(' ');

  return {
    description,
    inputSchema: z.object({
      prompt: z
        .string()
        .trim()
        .min(1)
        .max(1200)
        .describe('The visual question to ask about the footage. Be specific about the expected answer.'),
      videoId: z
        .string()
        .trim()
        .min(1)
        .describe('TwelveLabs videoId of the indexed asset (from the library asset twelveLabs.videoId).'),
      reason: z.string().trim().max(200).optional(),
    }),
    execute: async ({ prompt, videoId, reason }: AnalyzeFootageInput) => {
      const analyzer = deps.footageAnalyzer;
      if (!analyzer) {
        return {
          status: 'skipped',
          videoId,
          note: 'Footage analysis is not configured on this server.',
        };
      }

      deps.logger?.debug('Analyzing footage with TwelveLabs Pegasus.', { videoId });

      try {
        const answer = await analyzer.analyzeVideo({ videoId, prompt });
        const trimmed = answer.trim();

        if (!trimmed) {
          return {
            status: 'completed',
            videoId,
            answer: '',
            note: 'Pegasus returned an empty response for this footage.',
          };
        }

        return {
          status: 'completed',
          videoId,
          answer: trimmed.slice(0, MAX_ANSWER_CHARACTERS),
          note: reason ?? 'Footage analysis completed successfully.',
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to analyze footage.';
        deps.logger?.warn('TwelveLabs footage analysis failed.', error);
        return {
          status: 'error',
          videoId,
          note: 'Failed to analyze footage.',
          error: message,
        };
      }
    },
    toModelOutput: ({ output }: { output: AnalyzeFootageResult }) => buildAnalyzeFootageModelOutput(output),
  } as unknown as Tool<AnalyzeFootageInput, AnalyzeFootageResult>;
}
