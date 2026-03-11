import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { TranslationResult } from "@shared/schema";

export interface WordSegment {
  text: string;
  isVocab: boolean;
  translation?: TranslationResult;
}

interface WordPopoverProps {
  segment: WordSegment;
  popoverId: number;
  openPopoverId: number | null;
  onOpenChange: (id: number | null) => void;
  onClickCapture: (x: number, y: number) => void;
  testIdPrefix?: string;
}

export function WordPopover({
  segment,
  popoverId,
  openPopoverId,
  onOpenChange,
  onClickCapture,
  testIdPrefix = "",
}: WordPopoverProps) {
  const isMatch = segment.isVocab || !!segment.translation;

  if (!isMatch) {
    if (segment.text === "\n\n") {
      return <br />;
    }
    return <span>{segment.text}</span>;
  }

  return (
    <Popover
      open={openPopoverId === popoverId}
      onOpenChange={(open) => onOpenChange(open ? popoverId : null)}
    >
      <PopoverTrigger asChild>
        <span
          className={`cursor-help transition-all duration-200 rounded-sm ${
            segment.isVocab
              ? "border-b-2 border-primary/60 bg-primary/10 hover:bg-primary/20"
              : "border-b-0 hover:border-b-2 hover:border-muted-foreground/30 hover:bg-muted/10"
          }`}
          onClick={(e) => onClickCapture(e.clientX, e.clientY)}
          data-testid={
            segment.isVocab
              ? `${testIdPrefix}vocab-word-${popoverId}`
              : `${testIdPrefix}translated-word-${popoverId}`
          }
        >
          {segment.text}
        </span>
      </PopoverTrigger>
      <PopoverContent
        className="w-52 p-4 bg-zinc-900 text-zinc-100 border-zinc-800 shadow-2xl rounded-xl text-center space-y-2 animate-in fade-in zoom-in duration-200 pointer-events-none"
        side="top"
        sideOffset={8}
      >
        <div className="text-2xl font-bold font-serif">{segment.text}</div>
        {segment.translation && (
          <>
            <div className="text-primary font-medium tracking-wide">
              {segment.translation.pinyin}
            </div>
            <div className="text-zinc-400 text-sm leading-snug">
              {segment.translation.english}
            </div>
          </>
        )}
      </PopoverContent>
    </Popover>
  );
}
