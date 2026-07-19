import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Play, Pause, RotateCcw, RotateCw, X, Loader2 } from "lucide-react";

const SPEEDS = [0.75, 1, 1.25, 1.5] as const;

function formatTime(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

interface ArticleAudioPlayerProps {
  audioUrl: string | null;
  isLoading: boolean;
  onClose: () => void;
}

export function ArticleAudioPlayer({ audioUrl, isLoading, onClose }: ArticleAudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [speedIndex, setSpeedIndex] = useState(1); // default 1x

  const speed = SPEEDS[speedIndex];

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !audioUrl) return;
    audio.playbackRate = speed;
    audio.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
  }, [audioUrl]);

  useEffect(() => {
    const audio = audioRef.current;
    if (audio) audio.playbackRate = speed;
  }, [speed]);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) {
      audio.play().then(() => setIsPlaying(true)).catch(() => {});
    } else {
      audio.pause();
      setIsPlaying(false);
    }
  };

  const skip = (delta: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = Math.min(
      Math.max(0, audio.currentTime + delta),
      duration || audio.duration || 0
    );
  };

  const cycleSpeed = () => setSpeedIndex((i) => (i + 1) % SPEEDS.length);

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background/95 backdrop-blur shadow-lg">
      <div className="max-w-3xl mx-auto px-4 py-2 flex items-center gap-2">
        {audioUrl && (
          <audio
            ref={audioRef}
            src={audioUrl}
            onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
            onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
            onEnded={() => setIsPlaying(false)}
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
          />
        )}

        {isLoading && !audioUrl ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-1">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Preparing audio…</span>
          </div>
        ) : (
          <>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => skip(-5)}
              title="Rewind 5 seconds"
              data-testid="button-audio-rewind"
            >
              <RotateCcw className="w-4 h-4" />
            </Button>
            <Button
              variant="default"
              size="icon"
              onClick={togglePlay}
              title={isPlaying ? "Pause" : "Play"}
              data-testid="button-audio-play-pause"
            >
              {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => skip(5)}
              title="Forward 5 seconds"
              data-testid="button-audio-forward"
            >
              <RotateCw className="w-4 h-4" />
            </Button>

            <span className="text-xs tabular-nums text-muted-foreground w-10 text-right">
              {formatTime(currentTime)}
            </span>
            <Slider
              className="flex-1"
              value={[currentTime]}
              min={0}
              max={duration || 1}
              step={0.1}
              onValueChange={([v]) => {
                const audio = audioRef.current;
                if (audio) {
                  audio.currentTime = v;
                  setCurrentTime(v);
                }
              }}
              data-testid="slider-audio-progress"
            />
            <span className="text-xs tabular-nums text-muted-foreground w-10">
              {formatTime(duration)}
            </span>

            <Button
              variant="ghost"
              size="sm"
              onClick={cycleSpeed}
              className="w-12 text-xs font-semibold tabular-nums"
              title="Playback speed"
              data-testid="button-audio-speed"
            >
              {speed}x
            </Button>
          </>
        )}

        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          title="Close player"
          data-testid="button-audio-close"
        >
          <X className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
