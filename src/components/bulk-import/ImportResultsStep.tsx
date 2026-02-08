import { useState, useCallback, useEffect } from 'react';
import { ButtonPrimary, ButtonSecondary, ProgressBar } from '@/components/neesh';
import { FileUploadZone } from '@/components/neesh/FileUploadZone';
import { useFileUpload } from '@/hooks/useFileUpload';
import { supabase } from '@/integrations/supabase/client';
import { CheckCircle2, XCircle, Upload, Download, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import type { ImportResults } from '@/hooks/useBulkImport';
import type { ValidatedRow } from '@/lib/csvFieldMapping';

interface ImportedTitle {
  id: string;
  title: string;
  issue_number: string | null;
  cover_image_url: string | null;
  csvCoverUrl: string | null;
}

interface ImportResultsStepProps {
  results: ImportResults;
  importProgress: number;
  isImporting: boolean;
  validatedRows: ValidatedRow[];
  excludedRows: Set<number>;
  onDone: () => void;
}

export function ImportResultsStep({
  results,
  importProgress,
  isImporting,
  validatedRows,
  excludedRows,
  onDone,
}: ImportResultsStepProps) {
  const [titles, setTitles] = useState<ImportedTitle[]>([]);
  const [loadingTitles, setLoadingTitles] = useState(false);
  const [downloadingAll, setDownloadingAll] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  // Fetch imported title details once results are available
  const fetchTitles = useCallback(async () => {
    if (results.importedIds.length === 0) return;
    setLoadingTitles(true);

    const { data } = await supabase
      .from('magazines')
      .select('id, title, issue_number, cover_image_url')
      .in('id', results.importedIds);

    if (data) {
      // Match cover_image_url from CSV data to imported titles
      const activeValid = validatedRows.filter(
        (r) => r.isValid && !excludedRows.has(r.rowIndex)
      );

      const mapped: ImportedTitle[] = data.map((d, i) => ({
        id: d.id,
        title: d.title,
        issue_number: d.issue_number,
        cover_image_url: d.cover_image_url,
        csvCoverUrl: (activeValid[i]?.data?.cover_image_url as string) || null,
      }));
      setTitles(mapped);
    }
    setLoadingTitles(false);
  }, [results.importedIds, validatedRows, excludedRows]);

  // Trigger fetch on first render with results
  useEffect(() => {
    if (!isImporting && results.importedIds.length > 0) {
      fetchTitles();
    }
  }, [isImporting, results.importedIds.length, fetchTitles]);

  const downloadCoverImage = useCallback(
    async (titleId: string, url: string) => {
      setDownloadingId(titleId);
      try {
        const { data, error } = await supabase.functions.invoke(
          'download-cover-image',
          {
            body: { url, magazine_id: titleId },
          }
        );

        if (error) throw new Error(error.message);
        if (data?.error) throw new Error(data.error);

        // Update local state with new cover URL
        setTitles((prev) =>
          prev.map((t) =>
            t.id === titleId
              ? { ...t, cover_image_url: data.cover_image_url, csvCoverUrl: null }
              : t
          )
        );
        toast.success('Cover image saved');
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : 'Failed to download cover image'
        );
      } finally {
        setDownloadingId(null);
      }
    },
    []
  );

  const downloadAllCoverImages = useCallback(async () => {
    const withUrls = titles.filter((t) => t.csvCoverUrl && !t.cover_image_url);
    if (withUrls.length === 0) return;

    setDownloadingAll(true);
    let success = 0;

    for (const title of withUrls) {
      try {
        await downloadCoverImage(title.id, title.csvCoverUrl!);
        success++;
      } catch {
        // continue with others
      }
    }

    toast.success(`Downloaded ${success} of ${withUrls.length} cover images`);
    setDownloadingAll(false);
  }, [titles, downloadCoverImage]);

  if (isImporting) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-semibold text-foreground">Importing...</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Please don't close this page while the import is in progress.
          </p>
        </div>
        <ProgressBar current={importProgress} total={100} showLabel />
      </div>
    );
  }

  const titlesWithCsvUrl = titles.filter(
    (t) => t.csvCoverUrl && !t.cover_image_url
  );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-foreground">Import Complete</h2>
      </div>

      {/* Results summary */}
      <div className="flex items-center gap-6 p-4 rounded-lg bg-muted/50 border border-border">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 text-green-600" />
          <span className="text-sm font-medium">{results.imported} imported</span>
        </div>
        {results.failed > 0 && (
          <div className="flex items-center gap-2">
            <XCircle className="w-5 h-5 text-red-500" />
            <span className="text-sm font-medium">{results.failed} failed</span>
          </div>
        )}
      </div>

      {results.errors.length > 0 && (
        <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4">
          <p className="text-sm font-medium text-destructive mb-2">Errors:</p>
          <ul className="text-sm text-destructive space-y-1">
            {results.errors.map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Cover Image Upload Grid */}
      {titles.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium text-foreground">
              Cover Images
            </h3>
            {titlesWithCsvUrl.length > 0 && (
              <ButtonSecondary
                onClick={downloadAllCoverImages}
                disabled={downloadingAll}
              >
                {downloadingAll ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Download className="w-4 h-4 mr-2" />
                )}
                Download All URLs ({titlesWithCsvUrl.length})
              </ButtonSecondary>
            )}
          </div>

          {loadingTitles ? (
            <div className="flex items-center justify-center p-8">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {titles.map((title) => (
                <CoverImageCard
                  key={title.id}
                  title={title}
                  isDownloading={downloadingId === title.id}
                  onDownload={(url) => downloadCoverImage(title.id, url)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      <div className="flex justify-end pt-2">
        <ButtonPrimary onClick={onDone}>Done</ButtonPrimary>
      </div>
    </div>
  );
}

function CoverImageCard({
  title,
  isDownloading,
  onDownload,
}: {
  title: ImportedTitle;
  isDownloading: boolean;
  onDownload: (url: string) => void;
}) {
  const { upload, isUploading, progress } = useFileUpload({
    bucket: 'magazine-assets',
    folder: 'covers',
    onUploadComplete: async (url) => {
      await supabase
        .from('magazines')
        .update({ cover_image_url: url })
        .eq('id', title.id);
      toast.success(`Cover uploaded for "${title.title}"`);
    },
    onError: (err) => toast.error(err),
  });

  const handleFiles = async (files: File[]) => {
    if (files[0]) await upload(files[0]);
  };

  return (
    <div className="rounded-lg border border-border bg-background overflow-hidden">
      {/* Cover preview or upload zone */}
      {title.cover_image_url ? (
        <div className="aspect-[3/4] bg-muted">
          <img
            src={title.cover_image_url}
            alt={title.title}
            className="w-full h-full object-cover"
          />
        </div>
      ) : title.csvCoverUrl ? (
        <div className="aspect-[3/4] bg-muted relative">
          <img
            src={title.csvCoverUrl}
            alt={title.title}
            className="w-full h-full object-cover opacity-60"
          />
          <div className="absolute inset-0 flex items-center justify-center">
            <button
              onClick={() => onDownload(title.csvCoverUrl!)}
              disabled={isDownloading}
              className="px-3 py-1.5 bg-background/90 rounded-lg text-xs font-medium hover:bg-background transition-colors flex items-center gap-1.5"
            >
              {isDownloading ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <Download className="w-3 h-3" />
              )}
              Save
            </button>
          </div>
        </div>
      ) : (
        <div className="aspect-[3/4]">
          <FileUploadZone
            title="Upload"
            subtitle=""
            accept="image/*"
            onFilesSelected={handleFiles}
            isUploading={isUploading}
            uploadProgress={progress}
          />
        </div>
      )}

      {/* Title info */}
      <div className="p-2">
        <p className="text-xs font-medium text-foreground truncate">
          {title.title}
        </p>
        {title.issue_number && (
          <p className="text-[11px] text-muted-foreground truncate">
            #{title.issue_number}
          </p>
        )}
      </div>
    </div>
  );
}
