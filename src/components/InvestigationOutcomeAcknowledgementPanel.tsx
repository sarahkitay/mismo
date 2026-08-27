import { useLayoutEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

const PEN_CURSOR =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='28' height='28' viewBox='0 0 28 28'%3E%3Cpath d='M5 22 L3 25 L6 26 L8 23 Z' fill='%230f172a'/%3E%3Cpath d='M6 21 L18 5 L22 9 L9 22 Z' fill='%23334155'/%3E%3Cpath d='M18 4 L21 7' stroke='%2364748b' stroke-width='1.2' stroke-linecap='round'/%3E%3C/svg%3E\") 6 22, crosshair";

type AckMode = 'choose' | 'sign' | 'disagree';

interface InvestigationOutcomeAcknowledgementPanelProps {
  summary: string;
  requiresSignature?: boolean;
  attachment?: { fileName: string; dataUrl: string };
  className?: string;
  onAgree: (signatureDataUrl?: string) => void;
  onDisagree: (note: string) => void;
  onAcknowledgeRead?: () => void;
}

function distance(ax: number, ay: number, bx: number, by: number) {
  return Math.hypot(bx - ax, by - ay);
}

export function InvestigationOutcomeAcknowledgementPanel({
  summary,
  requiresSignature = true,
  attachment,
  className,
  onAgree,
  onDisagree,
  onAcknowledgeRead,
}: InvestigationOutcomeAcknowledgementPanelProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const drawingRef = useRef(false);
  const lastRef = useRef<{ x: number; y: number } | null>(null);
  const inkDistanceRef = useRef(0);
  const [mode, setMode] = useState<AckMode>('choose');
  const [hasInk, setHasInk] = useState(false);
  const [disagreeNote, setDisagreeNote] = useState('');

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
    onAgree(canvas.toDataURL('image/png'));
  };

  return (
    <div className={cn('space-y-4', className)}>
      <div className="rounded-md bg-[var(--color-surface-200)] p-4 text-sm whitespace-pre-wrap text-[var(--mismo-text)]">
        {summary}
      </div>
      {attachment && (
        <a
          href={attachment.dataUrl}
          download={attachment.fileName}
          className="text-sm text-[var(--mismo-blue)] hover:underline"
        >
          Download attachment: {attachment.fileName}
        </a>
      )}

      {requiresSignature ? (
        <>
          <p className="text-sm text-[var(--mismo-text-secondary)]">
            Do you agree that this investigation is complete and the issue is resolved?
          </p>

          {mode === 'choose' && (
            <div className="flex flex-col sm:flex-row gap-2">
              <Button type="button" className="bg-emerald-600 hover:bg-emerald-700" onClick={() => setMode('sign')}>
                Yes, I agree and sign off
              </Button>
              <Button type="button" variant="outline" onClick={() => setMode('disagree')}>
                No, I do not agree
              </Button>
            </div>
          )}

          {mode === 'sign' && (
            <>
              <p className="text-sm text-[var(--mismo-text-secondary)]">
                Sign below to confirm you agree the investigation is finished and the issue is resolved.
              </p>
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
                className="bg-emerald-600 hover:bg-emerald-700"
                disabled={!hasInk}
                onClick={handleSubmitSignature}
              >
                Submit sign-off
              </Button>
            </>
          )}

          {mode === 'disagree' && (
            <>
              <p className="text-sm text-[var(--mismo-text-secondary)]">
                Tell HR what you disagree with. Your response is saved to your file and the investigation record.
              </p>
              <Textarea
                rows={4}
                value={disagreeNote}
                onChange={(e) => setDisagreeNote(e.target.value)}
                placeholder="What part of the outcome do you disagree with?"
              />
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  disabled={!disagreeNote.trim()}
                  onClick={() => onDisagree(disagreeNote.trim())}
                >
                  Submit response
                </Button>
                <Button type="button" variant="ghost" onClick={() => setMode('choose')}>
                  Back
                </Button>
              </div>
            </>
          )}
        </>
      ) : (
        <div className="pt-2">
          <p className="text-xs text-[var(--mismo-text-secondary)] mb-2">No signature is required for this outcome letter.</p>
          <Button type="button" variant="secondary" onClick={() => onAcknowledgeRead?.()}>
            I&apos;ve read the outcome
          </Button>
        </div>
      )}
    </div>
  );
}
