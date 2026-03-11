import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Slider } from "@/components/ui/slider";
import { ArrowLeft, ExternalLink, Volume2, Type, RefreshCw, Newspaper } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { WordPopover, type WordSegment } from "@/components/word-popover";
import type { ArticleFeed, ArticleContent } from "@shared/schema";

interface ProcessedArticle {
  content: ArticleContent & { translatedTitle?: string };
  titleSegments: WordSegment[];
  segments: WordSegment[];
  vocabMatches: string[];
}

function ArticleView({ 
  article, 
  onBack, 
  fontSize, 
  saveFontSize, 
  lineHeight, 
  saveLineHeight,
  playAudio
}: { 
  article: ArticleFeed; 
  onBack: () => void;
  fontSize: number;
  saveFontSize: (v: number) => void;
  lineHeight: number;
  saveLineHeight: (v: number) => void;
  playAudio: (t: string) => Promise<void>;
}) {
  const [openPopoverId, setOpenPopoverId] = useState<number | null>(null);
  const [lastMousePos, setLastMousePos] = useState({ x: 0, y: 0 });

  const articleMutation = useMutation({
    mutationFn: async (article: ArticleFeed) => {
      const res = await apiRequest("POST", "/api/news/article", {
        url: article.link,
        needsConversion: article.feedName?.includes("BBC") ?? false,
      });
      return res.json() as Promise<ProcessedArticle>;
    },
  });

  useEffect(() => {
    articleMutation.mutate(article);
  }, [article.link]);

  const handlePopoverClick = (x: number, y: number) => {
    setLastMousePos({ x, y });
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-4 space-y-4">
      <div className="flex items-center justify-between gap-2 sticky top-14 z-40 bg-background/95 backdrop-blur py-2 -mx-4 px-4 border-b">
        <Button
          variant="ghost"
          size="sm"
          onClick={onBack}
          data-testid="button-back-to-feed"
        >
          <ArrowLeft className="w-4 h-4 mr-1" />
          Back
        </Button>
        <div className="flex items-center gap-1">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="icon" data-testid="button-reader-settings">
                <Type className="w-4 h-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64 space-y-4" align="end">
              <div className="space-y-2">
                <label className="text-sm font-medium">Font Size: {fontSize}px</label>
                <Slider
                  value={[fontSize]}
                  onValueChange={([v]) => saveFontSize(v)}
                  min={14}
                  max={28}
                  step={1}
                  data-testid="slider-font-size"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Line Height: {lineHeight.toFixed(1)}</label>
                <Slider
                  value={[lineHeight * 10]}
                  onValueChange={([v]) => saveLineHeight(v / 10)}
                  min={14}
                  max={28}
                  step={1}
                  data-testid="slider-line-height"
                />
              </div>
            </PopoverContent>
          </Popover>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => window.open(article.link, "_blank")}
            data-testid="button-view-original"
          >
            <ExternalLink className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <div className="space-y-4">
        <div>
          {/* Metadata-first: show title and source immediately */}
          {article.translatedTitle && (
            <h1 
              className="text-2xl font-bold font-serif leading-relaxed text-foreground dark:text-zinc-100 mb-1"
              style={{ fontSize: fontSize + 4 }}
              data-testid="text-article-translated-title"
            >
              {article.translatedTitle}
            </h1>
          )}
          
          {/* Fallback to original title while loading or if translation fails */}
          {!articleMutation.data && (
            <h1
              className="text-2xl font-bold font-serif leading-relaxed"
              style={{ fontSize: fontSize + 4 }}
              data-testid="text-article-title-original"
            >
              {article.title}
            </h1>
          )}

          {articleMutation.data && (
            <h1
              className="text-2xl font-bold font-serif leading-relaxed"
              style={{ fontSize: fontSize + 4 }}
              data-testid="text-article-title-segmented"
            >
              {articleMutation.data.titleSegments.map((seg, i) => (
                <WordPopover
                  key={i}
                  segment={seg}
                  popoverId={i + 10000}
                  openPopoverId={openPopoverId}
                  onOpenChange={setOpenPopoverId}
                  onClickCapture={handlePopoverClick}
                  testIdPrefix="title-"
                />
              ))}
            </h1>
          )}

          <div className="flex items-center gap-2 mt-2">
            {articleMutation.data && articleMutation.data.vocabMatches.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-xs font-bold text-primary hover:text-primary hover:bg-primary/10 flex items-center gap-1"
                onClick={() => {
                  const vocabCard = document.querySelector('[data-testid="vocab-matches-card"]');
                  if (vocabCard) {
                    vocabCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
                  }
                }}
                data-testid="button-vocab-count-indicator"
              >
                Vocabulary: {articleMutation.data.vocabMatches.length}
              </Button>
            )}
            <Badge variant="secondary">{article.feedName}</Badge>
            {article.published && (
              <span className="text-xs text-muted-foreground">
                {(() => {
                  const d = new Date(article.published);
                  return `${d.getFullYear()}年${String(d.getMonth() + 1).padStart(2, '0')}月${String(d.getDate()).padStart(2, '0')}日`;
                })()}
              </span>
            )}
            <Button
              size="icon"
              variant="ghost"
              onClick={() => playAudio(articleMutation.data?.content.title || article.title)}
              data-testid="button-play-title"
            >
              <Volume2 className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {articleMutation.isPending && (
          <div className="space-y-4 py-8">
            <div className="space-y-2 pt-4">
              {Array.from({ length: 12 }).map((_, i) => (
                <Skeleton key={i} className="h-4 w-full" />
              ))}
            </div>
            <p className="text-sm text-muted-foreground text-center pt-2" data-testid="text-loading-article">
              Processing text and matching vocabulary...
            </p>
          </div>
        )}

        {articleMutation.isError && (
          <Card className="p-6 text-center space-y-3">
            <p className="text-muted-foreground">Failed to process article text.</p>
            <div className="flex flex-col gap-2 items-center">
              <Button variant="default" onClick={() => articleMutation.mutate(article)} data-testid="button-retry-article">
                <RefreshCw className="w-4 h-4 mr-2" />
                Retry
              </Button>
              <Button variant="outline" onClick={() => window.open(article.link, "_blank")} data-testid="button-view-original-error">
                <ExternalLink className="w-4 h-4 mr-2" />
                View Original
              </Button>
            </div>
          </Card>
        )}

        {articleMutation.data && (
          <div className="space-y-4">
            <div
              className="font-serif leading-relaxed"
              style={{ fontSize, lineHeight }}
              data-testid="text-article-body"
              onMouseMove={(e) => {
                if (openPopoverId !== null) {
                  const dist = Math.sqrt(
                    Math.pow(e.clientX - lastMousePos.x, 2) + 
                    Math.pow(e.clientY - lastMousePos.y, 2)
                  );
                  if (dist > 10) {
                    setOpenPopoverId(null);
                  }
                }
              }}
            >
              {articleMutation.data.segments.map((seg, i) => (
                <WordPopover
                  key={i}
                  segment={seg}
                  popoverId={i}
                  openPopoverId={openPopoverId}
                  onOpenChange={setOpenPopoverId}
                  onClickCapture={handlePopoverClick}
                />
              ))}
            </div>

            {articleMutation.data.vocabMatches.length > 0 && (
              <Card className="p-4 space-y-2" data-testid="vocab-matches-card">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                  Vocabulary Found ({articleMutation.data.vocabMatches.length})
                </h3>
                <div className="flex flex-wrap gap-2">
                  {articleMutation.data.vocabMatches.map((word, i) => (
                    <Badge key={i} variant="secondary" className="text-sm font-serif" data-testid={`badge-vocab-match-${i}`}>
                      {word}
                    </Badge>
                  ))}
                </div>
              </Card>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function NewsPage() {
  const [selectedArticle, setSelectedArticle] = useState<ArticleFeed | null>(null);
  const [fontSize, setFontSize] = useState(() => {
    const stored = localStorage.getItem("reader_font_size");
    return stored ? parseInt(stored) : 18;
  });
  const [lineHeight, setLineHeight] = useState(() => {
    const stored = localStorage.getItem("reader_line_height");
    return stored ? parseFloat(stored) : 1.8;
  });
  const { toast } = useToast();

  const { data: articles, isLoading: feedLoading, refetch: refetchFeed } = useQuery<ArticleFeed[]>({
    queryKey: ["/api/news/feeds"],
    staleTime: 5 * 60 * 1000,
  });

  const playAudio = async (text: string) => {
    try {
      const res = await apiRequest("POST", "/api/tts", { text });
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audio.play();
      audio.onended = () => URL.revokeObjectURL(url);
    } catch (e) {
      console.error("TTS error:", e);
    }
  };

  const saveFontSize = (val: number) => {
    setFontSize(val);
    localStorage.setItem("reader_font_size", val.toString());
  };

  const saveLineHeight = (val: number) => {
    setLineHeight(val);
    localStorage.setItem("reader_line_height", val.toString());
  };

  const handleArticleClick = (article: ArticleFeed) => {
    if (!article.isFree) {
      window.open(article.link, "_blank");
      return;
    }
    setSelectedArticle(article);
  };

  if (selectedArticle) {
    return (
      <ArticleView 
        article={selectedArticle} 
        onBack={() => setSelectedArticle(null)}
        fontSize={fontSize}
        saveFontSize={saveFontSize}
        lineHeight={lineHeight}
        saveLineHeight={saveLineHeight}
        playAudio={playAudio}
      />
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-4">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="relative flex items-baseline gap-2 text-2xl sm:text-4xl font-serif font-bold tracking-tight" data-testid="text-news-title">
            <span>News Feed</span>
            <div className="h-6 w-[2px] bg-primary rotate-12 mx-1 self-center" />
            <span>消息来源</span>
          </h1>
          <p className="text-sm text-muted-foreground">Read native Chinese content matched to your vocabulary</p>
        </div>
        <Button
          variant="outline"
          size="icon"
          onClick={() => refetchFeed()}
          disabled={feedLoading}
          data-testid="button-refresh-feed"
        >
          <RefreshCw className={`w-4 h-4 ${feedLoading ? "animate-spin" : ""}`} />
        </Button>
      </div>
      {feedLoading && (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Card key={i} className="p-4 space-y-2">
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-3 w-1/4" />
            </Card>
          ))}
        </div>
      )}
      {articles && articles.length === 0 && (
        <Card className="p-8 text-center border-dashed">
          <Newspaper className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
          <p className="text-muted-foreground">No articles available right now. Try refreshing.</p>
        </Card>
      )}
      {articles && articles.length > 0 && (
        <div className="space-y-2">
          {articles.map((article, i) => (
            <Card
              key={i}
              className="p-4 cursor-pointer hover-elevate active-elevate-2 transition-colors"
              onClick={() => handleArticleClick(article)}
              data-testid={`card-article-${i}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0 space-y-1">
                  {article.translatedTitle && (
                    <h3 className="font-serif font-semibold text-lg leading-tight text-foreground dark:text-zinc-100" data-testid={`text-article-translated-title-${i}`}>
                      {article.translatedTitle}
                    </h3>
                  )}
                  <h3 className="font-serif font-semibold text-lg leading-tight" data-testid={`text-article-title-${i}`}>
                    {article.title}
                  </h3>
                  {article.summary && (
                    <p className="text-sm text-muted-foreground line-clamp-2">{article.summary.replace(/<[^>]*>/g, "")}</p>
                  )}
                  <div className="flex items-center justify-between gap-2 pt-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="secondary" className="text-xs">
                        {article.feedName}
                      </Badge>
                      <Badge variant={article.isFree ? "secondary" : "outline"} className="text-xs">
                        {article.isFree ? "Free" : "Paywall"}
                      </Badge>
                      {article.published && (
                        <span className="text-xs text-muted-foreground">
                          {(() => {
                            const d = new Date(article.published);
                            return `${d.getFullYear()}年${String(d.getMonth() + 1).padStart(2, '0')}月${String(d.getDate()).padStart(2, '0')}日`;
                          })()}
                        </span>
                      )}
                      {!article.isFree && <ExternalLink className="w-3 h-3 text-muted-foreground" />}
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {article.matchedKeywords && article.matchedKeywords.slice(0, 3).map((kw, ki) => (
                        <Badge key={ki} variant="secondary" className="text-xs" data-testid={`badge-interest-${i}-${ki}`}>
                          {kw}
                        </Badge>
                      ))}
                      {article.vocabCount !== undefined && article.vocabCount > 0 && (
                        <Badge variant="secondary" className="text-xs" style={{ color: "#ca352b" }} data-testid={`badge-vocab-count-${i}`}>
                          {article.vocabCount}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
