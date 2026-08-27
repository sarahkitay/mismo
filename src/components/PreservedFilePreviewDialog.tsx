import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Icons } from '@/lib/icons';
import { getPreservedFileKind, type PreservedFilePreviewSource } from '@/lib/preservedFilePreview';

interface PreservedFilePreviewDialogProps {
  file: PreservedFilePreviewSource | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  subtitle?: string;
}

function dataUrlToBlobUrl(dataUrl: string): string | null {
  try {
    const [header, base64] = dataUrl.split(',');
    if (!base64) return null;
    const mime = header.match(/:(.*?);/)?.[1] ?? 'application/octet-stream';
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    return URL.createObjectURL(new Blob([bytes], { type: mime }));
  } catch {
    return null;
  }
}

export function PreservedFilePreviewDialog({ file, open, onOpenChange, subtitle }: PreservedFilePreviewDialogProps) {
  const kind = file ? getPreservedFileKind(file) : 'other';
  const [blobUrl, setBlobUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !file) {
      setBlobUrl(null);
      return;
    }
    if (kind === 'pdf') {
      const next = dataUrlToBlobUrl(file.dataUrl);
      setBlobUrl(next);
      return () => {
        if (next) URL.revokeObjectURL(next);
      };
    }
    setBlobUrl(null);
    return undefined;
  }, [file, kind, open]);

  const previewSrc = useMemo(() => {
    if (!file) return '';
    if (kind === 'pdf') return blobUrl ?? file.dataUrl;
    return file.dataUrl;
  }, [blobUrl, file, kind]);

  if (!file) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="flex h-[min(92vh,900px)] w-[min(96vw,1200px)] max-w-none flex-col gap-0 overflow-hidden p-0 sm:max-w-none"
        showCloseButton
      >
        <DialogHeader className="shrink-0 border-b border-[var(--color-border-200)] px-5 py-4 text-left">
          <DialogTitle className="truncate pr-8">{file.fileName}</DialogTitle>
          {subtitle ? <DialogDescription>{subtitle}</DialogDescription> : null}
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-auto bg-[var(--color-surface-200)] p-4">
          {kind === 'image' ? (
            <div className="flex h-full min-h-[50vh] items-center justify-center">
              <img
                src={file.dataUrl}
                alt={file.fileName}
                className="max-h-[calc(92vh-8rem)] max-w-full object-contain shadow-sm"
              />
            </div>
          ) : kind === 'pdf' ? (
            <iframe
              title={file.fileName}
              src={previewSrc}
              className="h-[calc(92vh-8rem)] min-h-[50vh] w-full rounded-md border border-[var(--color-border-200)] bg-white"
            />
          ) : (
            <div className="flex h-full min-h-[40vh] flex-col items-center justify-center gap-4 text-center">
              <Icons.reports className="h-12 w-12 text-[var(--color-text-muted)]" />
              <p className="max-w-md text-sm text-[var(--mismo-text-secondary)]">
                Preview is not available for this file type in Mismo. Download the preserved copy to open it on your
                device.
              </p>
              <Button asChild variant="outline">
                <a href={file.dataUrl} download={file.fileName}>
                  Download {file.fileName}
                </a>
              </Button>
            </div>
          )}
        </div>

        <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-[var(--color-border-200)] px-5 py-3">
          <p className="text-xs text-[var(--color-text-muted)]">Preserved evidence · view only</p>
          <Button asChild size="sm" variant="outline">
            <a href={file.dataUrl} download={file.fileName}>
              Download
            </a>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
