import type { ReactNode } from 'react';

function inlineMarkup(value: string): ReactNode[] {
  return value.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g).map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) return <strong key={index}>{part.slice(2, -2)}</strong>;
    if (part.startsWith('*') && part.endsWith('*')) return <em key={index}>{part.slice(1, -1)}</em>;
    return part;
  });
}

export function MemoBody({ content }: { content: string }) {
  return (
    <div className="space-y-2 text-sm leading-relaxed">
      {content.split('\n').map((line, index) => {
        const bullet = line.match(/^\s*[-•]\s+(.*)$/);
        if (bullet) {
          return <div key={index} className="flex gap-2 pl-2"><span aria-hidden="true">•</span><p>{inlineMarkup(bullet[1])}</p></div>;
        }
        return line ? <p key={index}>{inlineMarkup(line)}</p> : <div key={index} className="h-2" aria-hidden="true" />;
      })}
    </div>
  );
}
