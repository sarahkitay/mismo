import { useLayoutEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

const PEN_CURSOR =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='28' height='28' viewBox='0 0 28 28'%3E%3Cpath d='M5 22 L3 25 L6 26 L8 23 Z' fill='%230f172a'/%3E%3Cpath d='M6 21 L18 5 L22 9 L9 22 Z' fill='%23334155'/%3E%3Cpath d='M18 4 L21 7' stroke='%2364748b' stroke-width='1.2' stroke-linecap='round'/%3E%3C/svg%3E\") 6 22, crosshair";

import type { InvestigationAttachment } from '@/types';

type AckVariant = 'case_note' | 'initial_contact';
type AckMode = 'choose' | 'sign' | 'revise';

interface CaseNoteAcknowledgementPanelProps {
  subject: string;
  body: string;
  variant?: AckVariant;
  attachments?: InvestigationAttachment[];
  className?: string;
  onConfirm: (signatureDataUrl: string) => void;
  onRequestRevision: (note: string) => void;
}

function distance(ax: number, ay: number, bx: number, by: number) {
  return Math.hypot(bx - ax, by - ay);
}

export function CaseNoteAcknowledgementPanel({
  subject,
  body,
  variant = 'case_note',
  attachments = [],
  className,
  onConfirm,
  onRequestRevision,
}: CaseNoteAcknowledgementPanelProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const drawingRef = useRef(false);
  const lastRef = useRef<{ x: number; y: number } | null>(null);
  const inkDistanceRef = useRef(0);
  const [mode, setMode] = useState<AckMode>('choose');
  const [hasInk, setHasInk] = useState(false);
  const [revisionNote, setRevisionNote] = useState('');

  const layoutCanvas = () => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;
    const rect = wrap.getBoundingClientRect();
    if (rect.width < 8 || rect.height < 8) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.floor(rect.width);
    const h = Math.floor(rect.height);
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 2;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w, h);
    ctxRef.current = ctx;
    inkDistanceRef.current = 0;
    setHasInk(false);
    lastRef.current = null;
  };

  useLayoutEffect(() => {
    if (mode !== 'sign') return;
    let tries = 0;
    const run = () => {
      tries += 1;
      const wrap = wrapRef.current;
      if (wrap && wrap.getBoundingClientRect().width >= 8) {
        layoutCanvas();
        return;
      }
      if (tries < 12) requestAnimationFrame(run);
    };
    run();
  }, [mode]);

  const getPos = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0]?.clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0]?.clientY : e.clientY;
    if (clientX == null || clientY == null) return null;
    return { x: clientX - rect.left, y: clientY - rect.top };
  };

  const startStroke = (e: React.MouseEvent | React.TouchEvent) => {
    if (mode !== 'sign') return;
    const p = getPos(e);
    if (!p) return;
    drawingRef.current = true;
    lastRef.current = p;
    if ('touches' in e) e.preventDefault();
  };

  const drawStroke = (e: React.MouseEvent | React.TouchEvent) => {
    if (!drawingRef.current || mode !== 'sign') return;
    const ctx = ctxRef.current;
    const last = lastRef.current;
    const p = getPos(e);
    if (!ctx || !last || !p) return;
    const d = distance(last.x, last.y, p.x, p.y);
    if (d > 0.3) {
      inkDistanceRef.current += d;
      if (inkDistanceRef.current > 20) setHasInk(true);
    }
    ctx.beginPath();
    ctx.moveTo(last.x, last.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    lastRef.current = p;
    if ('touches' in e) e.preventDefault();
  };

  const endStroke = () => {
    drawingRef.current = false;
    lastRef.current = null;
  };

  const handleSubmitSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas || mode !== 'sign' || !hasInk) return;
    onConfirm(canvas.toDataURL('image/png'));
  };

  const isInitialContact = variant === 'initial_contact';
  const reviewTitle = isInitialContact ? 'Initial contact summary for your review' : 'Case note for your review';
  const accuracyQuestion = isInitialContact
    ? 'Does this summary of our initial contact look accurate?'
    : 'Does this summary look accurate based on your conversation with HR?';
  const signPrompt = isInitialContact
    ? 'Sign below to confirm this initial contact summary is accurate.'
    : 'Sign below to confirm this case note is accurate.';
  const revisePrompt = isInitialContact
    ? 'Tell HR what should be corrected in this initial contact summary. Your notes are saved to your file and the investigation record.'
    : 'Tell HR what should be corrected. Your notes are saved to your employee file and the case record.';

  return (
    <div className={cn('rounded-lg border border-[var(--color-border-200)] bg-[var(--color-surface-100)] p-4 space-y-4', className)}>
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">{reviewTitle}</p>
        <p className="text-sm font-medium text-[var(--mismo-text)] mt-1">{subject}</p>
        <p className="text-sm text-[var(--mismo-text-secondary)] mt-3 whitespace-pre-wrap border border-[var(--color-border-200)] rounded-md bg-white p-3">
          {body}
        </p>
        {attachments.length > 0 && (
          <ul className="mt-3 space-y-2">
            {attachments.map((file) => (
              <li key={file.id} className="text-sm">
                <a href={file.dataUrl} download={file.fileName} className="text-[var(--mismo-blue)] hover:underline">
                  Download: {file.fileName}
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>

      <p className="text-sm text-[var(--mismo-text-secondary)]">{accuracyQuestion}</p>

      {mode === 'choose' && (
        <div className="flex flex-col sm:flex-row gap-2">
          <Button type="button" className="bg-[var(--mismo-blue)] hover:bg-blue-600" onClick={() => setMode('sign')}>
            Yes, this looks accurate
          </Button>
          <Button type="button" variant="outline" onClick={() => setMode('revise')}>
            No, I&apos;d like to revise this
          </Button>
        </div>
      )}

      {mode === 'sign' && (
        <>
          <p className="text-sm text-[var(--mismo-text-secondary)]">{signPrompt}</p>
          <div>
            <p className="text-xs font-medium text-[var(--mismo-text-secondary)] mb-2">Your signature</p>
            <div ref={wrapRef} className="relative w-full h-36 rounded-md border border-[var(--color-border-200)] overflow-hidden bg-white touch-none">
              <canvas
                ref={canvasRef}
                className="absolute inset-0 block w-full h-full"
                style={{ cursor: PEN_CURSOR }}
                onMouseDown={startStroke}
                onMouseMove={drawStroke}
                onMouseUp={endStroke}
                onMouseLeave={endStroke}
                onTouchStart={startStroke}
                onTouchMove={drawStroke}
                onTouchEnd={endStroke}
              />
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              <Button type="button" variant="outline" size="sm" onClick={layoutCanvas}>
                Clear signature
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => setMode('choose')}>
                Back
              </Button>
            </div>
          </div>
          <Button
            type="button"
            className="w-full sm:w-auto bg-[var(--mismo-blue)] hover:bg-blue-600"
            disabled={!hasInk}
            onClick={handleSubmitSignature}
          >
            Submit sign-off
          </Button>
        </>
      )}

      {mode === 'revise' && (
        <>
          <p className="text-sm text-[var(--mismo-text-secondary)]">{revisePrompt}</p>
          <Textarea
            rows={4}
            value={revisionNote}
            onChange={(e) => setRevisionNote(e.target.value)}
            placeholder="What part of this summary is inaccurate or missing?"
          />
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={!revisionNote.trim()}
              onClick={() => onRequestRevision(revisionNote.trim())}
            >
              Submit revision request
            </Button>
            <Button type="button" variant="ghost" onClick={() => setMode('choose')}>
              Back
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
