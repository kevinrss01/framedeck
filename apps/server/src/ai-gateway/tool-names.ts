export const aiGatewayToolNames = {
  investigateTranscription: 'investigate_transcription',
  analyzeFootage: 'analyze_footage',
  cutTimeRanges: 'cut_time_ranges',
} as const;

export type AiGatewayToolName = (typeof aiGatewayToolNames)[keyof typeof aiGatewayToolNames];
