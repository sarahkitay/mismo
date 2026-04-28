import { useLayoutEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';

/** Pen-style cursor; hotspot near nib tip for a hand-drawn feel. */
const PEN_CURSOR =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='28' height='28' viewBox='0 0 28 28'%3E%3Cpath d='M5 22 L3 25 L6 26 L8 23 Z' fill='%230f172a'/%3E%3Cpath d='M6 21 L18 5 L22 9 L9 22 Z' fill='%23334155'/%3E%3Cpath d='M18 4 L21 7' stroke='%2364748b' stroke-width='1.2' stroke-linecap='round'/%3E%3C/svg%3E\") 6 22, crosshair";

interface MemoSignatureAcknowledgementProps {
  policyId: string;
  policyTitle: string;
  className?: string;
  onSubmit: (signatureDataUrl: string) => void;
}

function distance(ax: number, ay: number, bx: number, by: number) {
  return Math.hypot(bx - ax, by - ay);
}

export function MemoSignatureAcknowledgement({ policyId, policyTitle, className, onSubmit }: MemoSignatureAcknowledgementProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const drawingRef = useRef(false);
  const lastRef = useRef<{ x: number; y: number } | null>(null);
  const inkDistanceRef = useRef(0);
  const [readUnderstood, setReadUnderstood] = useState(false);
  const [hasInk, setHasInk] = useState(false);

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
  }, [policyId]);

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
    if (!readUnderstood) return;
    const p = getPos(e);
    if (!p) return;
    drawingRef.current = true;
    lastRef.current = p;
    if ('touches' in e) e.preventDefault();
  };

  const drawStroke = (e: React.MouseEvent | React.TouchEvent) => {
    if (!drawingRef.current || !readUnderstood) return;
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

  const clearPad = () => {
    layoutCanvas();
  };

  const handleSubmit = () => {
    const canvas = canvasRef.current;
    if (!canvas || !readUnderstood || !hasInk) return;
    onSubmit(canvas.toDataURL('image/png'));
  };

  const canSubmit = readUnderstood && hasInk;
  const switchId = `memo-read-${policyId}`;

  return (
    <div className={cn('rounded-lg border border-[var(--color-border-200)] bg-[var(--color-surface-100)] p-4 space-y-4', className)}>
      <p className="text-xs text-[var(--mismo-text-secondary)]">
        Sign-off for: <span className="font-medium text-[var(--mismo-text)]">{policyTitle}</span>
      </p>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <Label htmlFor={switchId} className="cursor-pointer flex-1 text-sm font-normal text-[var(--mismo-text)]">
          I have read and understood this memo
        </Label>
        <Switch
          id={switchId}
          checked={readUnderstood}
          onCheckedChange={(v) => {
            setReadUnderstood(v);
            if (!v) {
              clearPad();
            }
          }}
        />
      </div>

      <div>
        <p className="text-xs font-medium text-[var(--mismo-text-secondary)] mb-2">Your signature</p>
        <div
          ref={wrapRef}
          className={cn(
            'relative w-full h-36 rounded-md border border-[var(--color-border-200)] overflow-hidden bg-white touch-none',
            readUnderstood ? '' : 'opacity-50 pointer-events-none'
          )}
        >
          <canvas
            ref={canvasRef}
            className="absolute inset-0 block w-full h-full"
            style={{ cursor: readUnderstood ? PEN_CURSOR : 'not-allowed' }}
            onMouseDown={startStroke}
            onMouseMove={drawStroke}
            onMouseUp={endStroke}
            onMouseLeave={endStroke}
            onTouchStart={startStroke}
            onTouchMove={drawStroke}
            onTouchEnd={endStroke}
          />
        </div>
        <p className="text-[11px] text-[var(--mismo-text-secondary)] mt-1.5">
          Use your mouse, trackpad, or finger to draw your signature in the box.
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" disabled={!readUnderstood} onClick={clearPad}>
            Clear signature
          </Button>
        </div>
      </div>

      <Button type="button" className="w-full sm:w-auto bg-[var(--mismo-blue)] hover:bg-blue-600" disabled={!canSubmit} onClick={handleSubmit}>
        Submit acknowledgement
      </Button>
    </div>
  );
}
