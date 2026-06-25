import { createAnalyzeFootageTool } from './analyze-footage.tools';
import type { FootageAnalyzer, ToolDependencies } from './types';

describe('createAnalyzeFootageTool', () => {
  const createDeps = (footageAnalyzer?: FootageAnalyzer) => {
    const deps: ToolDependencies = {
      realtimeService: {
        dispatchMessage: jest.fn(),
      } as unknown as ToolDependencies['realtimeService'],
      waitForToolResult: jest.fn() as unknown as ToolDependencies['waitForToolResult'],
      getLanguageModel: jest.fn() as unknown as ToolDependencies['getLanguageModel'],
      footageAnalyzer,
      logger: {
        log: jest.fn(),
        warn: jest.fn(),
        debug: jest.fn(),
      },
    };

    return deps;
  };

  it('documents that it uses TwelveLabs Pegasus for visual questions', () => {
    const tool = createAnalyzeFootageTool(createDeps());

    expect(tool.description).toContain('TwelveLabs Pegasus');
    expect(tool.description).toContain('investigate_transcription');
  });

  it('skips gracefully when no footage analyzer is configured', async () => {
    const tool = createAnalyzeFootageTool(createDeps(undefined));

    const result = await tool.execute?.(
      { prompt: 'What is on screen?', videoId: 'video-1' },
      { toolCallId: 'call-1', messages: [] },
    );

    expect(result).toEqual({
      status: 'skipped',
      videoId: 'video-1',
      note: 'Footage analysis is not configured on this server.',
    });
  });

  it('passes the videoId and prompt to the analyzer and returns the answer', async () => {
    const analyzeVideo = jest.fn().mockResolvedValue('  A person unboxes a laptop on a desk.  ');
    const tool = createAnalyzeFootageTool(createDeps({ analyzeVideo }));

    const result = await tool.execute?.(
      { prompt: 'Describe the action', videoId: 'video-42' },
      { toolCallId: 'call-2', messages: [] },
    );

    expect(analyzeVideo).toHaveBeenCalledWith({ videoId: 'video-42', prompt: 'Describe the action' });
    expect(result).toEqual({
      status: 'completed',
      videoId: 'video-42',
      answer: 'A person unboxes a laptop on a desk.',
      note: 'Footage analysis completed successfully.',
    });
  });

  it('returns an error result when the analyzer throws', async () => {
    const analyzeVideo = jest
      .fn()
      .mockRejectedValue(new Error('TwelveLabs analysis requires either videoUrl or videoId'));
    const tool = createAnalyzeFootageTool(createDeps({ analyzeVideo }));

    const result = await tool.execute?.(
      { prompt: 'Find the drone shot', videoId: 'video-9' },
      { toolCallId: 'call-3', messages: [] },
    );

    expect(result).toMatchObject({
      status: 'error',
      videoId: 'video-9',
      error: 'TwelveLabs analysis requires either videoUrl or videoId',
    });
  });
});
