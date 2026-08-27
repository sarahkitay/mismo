export type PreservedFileKind = 'image' | 'pdf' | 'other';

export interface PreservedFilePreviewSource {
  fileName: string;
  mimeType?: string;
  dataUrl: string;
}

export function getPreservedFileKind(file: Pick<PreservedFilePreviewSource, 'fileName' | 'mimeType' | 'dataUrl'>): PreservedFileKind {
  const mime = (file.mimeType ?? '').toLowerCase();
  const name = file.fileName.toLowerCase();
  if (mime.startsWith('image/') || file.dataUrl.startsWith('data:image/') || /\.(png|jpe?g|gif|webp|heic|bmp|svg)$/i.test(name)) {
    return 'image';
  }
  if (mime === 'application/pdf' || file.dataUrl.startsWith('data:application/pdf') || name.endsWith('.pdf')) {
    return 'pdf';
  }
  return 'other';
}

export const EVIDENCE_PROMPT_ACCEPT: Record<string, string> = {
  screenshots: 'image/png,image/jpeg,image/webp,image/gif,image/heic,.png,.jpg,.jpeg,.webp,.gif,.heic',
  communications:
    'image/png,image/jpeg,image/webp,image/gif,.png,.jpg,.jpeg,.webp,.gif,.pdf,application/pdf,.eml,.msg,text/plain',
  disciplinary: 'image/*,.pdf,application/pdf,.doc,.docx,.txt,.csv,.xlsx,.xls',
  'policy-ack': '.pdf,application/pdf,image/png,image/jpeg,.png,.jpg,.jpeg',
  statements: '.pdf,application/pdf,.doc,.docx,.txt,image/png,image/jpeg,.png,.jpg,.jpeg',
  logs: '.txt,.csv,.log,.json,.pdf,application/pdf',
};
