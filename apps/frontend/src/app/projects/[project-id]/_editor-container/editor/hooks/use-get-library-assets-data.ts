import { useCallback } from 'react';
import api from '@/utils/services/api-frontend';
import type { TwelveLabsVideoReference, VideoAnalysisSummary } from 'api-types';
import { editorToolNames } from 'api-types';
import { useLibraryAssets } from '../library';
import { useAssetStatus } from '../utils/use-context';

type GetLibraryAssetsDataOptions = {
  toolCallId?: string;
};

type LibraryAssetData = {
  assetId: string;
  fileName: string;
  fileType: string;
  mimeType: string;
  width?: number;
  height?: number;
  durationInSeconds?: number;
  status?: string;
  isReadyForPlacement: boolean;
  summary?: VideoAnalysisSummary;
  summaryError?: string;
  twelveLabs?: TwelveLabsVideoReference;
};

export const useGetLibraryAssetsData = () => {
  const { libraryAssets } = useLibraryAssets();
  const { assetStatus } = useAssetStatus();
  const { mutateAsync: reportToolResult } = api.tools.reportToolResult.useMutation();

  const buildLibraryAssetsData = useCallback((): LibraryAssetData[] => {
    const sourceLibraryAssets = Object.values(libraryAssets).filter((asset) => !asset.parentAssetId);

    return sourceLibraryAssets.map((asset) => {
      const statusRecord = assetStatus[asset.id];

      let simplifiedStatus: string | undefined;
      if (!statusRecord || statusRecord.type === 'pending-upload') {
        // Fallback: if asset has remoteUrl, it's already uploaded
        if ('remoteUrl' in asset && asset.remoteUrl) {
          simplifiedStatus = 'ready';
        } else {
          simplifiedStatus = 'pending-upload';
        }
      } else if (statusRecord.type === 'in-progress') {
        simplifiedStatus = 'uploading';
      } else if (statusRecord.type === 'transcribing') {
        simplifiedStatus = 'transcribing';
      } else if (statusRecord.type === 'uploaded') {
        simplifiedStatus = 'ready';
      } else if (statusRecord.type === 'error') {
        simplifiedStatus = 'error';
      } else {
        simplifiedStatus = 'ready';
      }

      const durationInSeconds =
        'durationInSeconds' in asset && typeof asset.durationInSeconds === 'number'
          ? Number(asset.durationInSeconds.toFixed(3))
          : undefined;

      const summary =
        asset.type === 'video' && 'summary' in asset ? (asset.summary as VideoAnalysisSummary | undefined) : undefined;
      const summaryError =
        asset.type === 'video' && 'summaryError' in asset && typeof asset.summaryError === 'string'
          ? asset.summaryError
          : undefined;
      const twelveLabs =
        asset.type === 'video' && 'twelveLabs' in asset
          ? (asset.twelveLabs as TwelveLabsVideoReference | undefined)
          : undefined;

      return {
        assetId: asset.id,
        fileName: asset.filename,
        fileType: asset.type,
        mimeType: asset.mimeType,
        width: 'width' in asset ? asset.width : undefined,
        height: 'height' in asset ? asset.height : undefined,
        durationInSeconds,
        status: simplifiedStatus,
        isReadyForPlacement: simplifiedStatus === 'ready',
        summary,
        summaryError,
        twelveLabs,
      };
    });
  }, [assetStatus, libraryAssets]);

  const getLibraryAssetsData = useCallback(
    async (options?: GetLibraryAssetsDataOptions) => {
      const toolCallId = options?.toolCallId;

      const report = async (status: 'success' | 'error', output?: Record<string, unknown>, error?: string) => {
        if (!toolCallId) return;
        try {
          await reportToolResult({
            body: {
              toolCallId,
              toolName: editorToolNames.getLibraryAssetsData,
              status,
              output,
              error,
            },
          });
        } catch (error) {
          console.error('Failed to report tool result', { toolCallId, status, error });
        }
      };

      try {
        const data = buildLibraryAssetsData();
        await report('success', { libraryAssets: data } as unknown as Record<string, unknown>);
        return data;
      } catch (error) {
        console.error('Failed to get library assets data', { error });
        const message = error instanceof Error ? error.message : 'Failed to get library assets data';
        await report('error', undefined, message);
        return null;
      }
    },
    [buildLibraryAssetsData, reportToolResult],
  );

  return { getLibraryAssetsData, buildLibraryAssetsData };
};
