import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  BookOpen,
  RotateCcw,
  Volume2,
  EyeOff,
  CheckCircle2,
  Flame,
  Zap,
  Target,
  Pencil,
  ListFilter,
} from "lucide-react";
import type {
  CardWithVocabulary,
  ReviewStats,
  ReviewRating,
  Vocabulary,
} from "@shared/schema";

import { useToast } from "@/hooks/use-toast";

export default function ReviewPage() {
  const { toast } = useToast();
  const [sessionCards, setSessionCards] = useState<CardWithVocabulary[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [reviewedCount, setReviewedCount] = useState(0);
  const [sessionActive, setSessionActive] = useState(false);
  const [isPracticeMode, setIsPracticeMode] = useState(false);
  const [isCustomPracticeMode, setIsCustomPracticeMode] = useState(false);
  const [customPickerOpen, setCustomPickerOpen] = useState(false);
  const [selectedSourceLessons, setSelectedSourceLessons] = useState<Record<string, number[]>>({});
  const [customPracticeFilters, setCustomPracticeFilters] = useState<{ sourceLessons: Record<string, number[]> } | null>(null);
  const [autoPlayAudio, setAutoPlayAudio] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editFields, setEditFields] = useState({
    simplified: "",
    pinyin: "",
    english: "",
    exampleSentence: "",
  });
  const prevShowAnswer = useRef(false);

  const tzOffset = new Date().getTimezoneOffset();
  const statsQueryKey = [`/api/review/stats?tzOffset=${tzOffset}`];

  const { data: stats, isLoading: statsLoading } = useQuery<ReviewStats>({
    queryKey: statsQueryKey,
  });

  const { data: words } = useQuery<Vocabulary[]>({
    queryKey: ["/api/vocabulary"],
  });

  const sourceLessonsMap = useMemo(() => {
    const map = new Map<string, Set<number>>();
    for (const w of words ?? []) {
      const wSources = w.source || [];
      const wLessons = w.lessonNumber || [];
      for (let i = 0; i < wSources.length; i++) {
        const src = wSources[i];
        const lesson = wLessons[i];
        if (src == null) continue;
        if (!map.has(src)) map.set(src, new Set());
        if (typeof lesson === "number" && !isNaN(lesson)) map.get(src)!.add(lesson);
      }
    }
    return map;
  }, [words]);

  useEffect(() => {
    const handleReset = () => {
      setSessionActive(false);
      setSessionCards([]);
      setCurrentIndex(0);
      setShowAnswer(false);
      setReviewedCount(0);
      setIsPracticeMode(false);
      setIsCustomPracticeMode(false);
      setCustomPracticeFilters(null);
    };
    window.addEventListener("resetReview", handleReset);
    return () => window.removeEventListener("resetReview", handleReset);
  }, []);

  const dailyGoal = 20;
  const goalProgress = stats
    ? Math.min((stats.reviewedToday / dailyGoal) * 100, 100)
    : 0;
  const goalMet = stats ? stats.reviewedToday >= dailyGoal : false;

  const startReviewMutation = useMutation({
    mutationFn: async (
      payload: { practice: boolean } | { custom: { sourceLessons: Record<string, number[]> } }
    ) => {
      if ("custom" in payload) {
        const res = await apiRequest("POST", "/api/review/custom", {
          sourceLessons: payload.custom.sourceLessons,
        });
        return res.json() as Promise<CardWithVocabulary[]>;
      }
      const url = payload.practice ? "/api/review/practice" : `/api/review/due?tzOffset=${tzOffset}`;
      const res = await apiRequest("GET", url);
      return res.json() as Promise<CardWithVocabulary[]>;
    },
    onSuccess: (cards, payload) => {
      if (cards.length > 0) {
        setSessionCards(cards);
        setCurrentIndex(0);
        setShowAnswer(false);
        setReviewedCount(0);
        setSessionActive(true);
        if ("custom" in payload) {
          setIsPracticeMode(false);
          setIsCustomPracticeMode(true);
          setCustomPracticeFilters(payload.custom);
          setCustomPickerOpen(false);
          setSelectedSourceLessons({});
        } else {
          setIsCustomPracticeMode(false);
          setCustomPracticeFilters(null);
          setIsPracticeMode(payload.practice);
        }
      } else {
        setReviewedCount(0);
        setSessionActive(false);
        toast({
          description: "No more cards available right now. Check back later!",
        });
      }
    },
  });

  const rateMutation = useMutation({
    mutationFn: async ({
      cardId,
      rating,
    }: {
      cardId: number;
      rating: ReviewRating;
    }) => {
      await apiRequest("POST", `/api/review/rate`, { cardId, rating, tzOffset });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: statsQueryKey });
      const newReviewed = reviewedCount + 1;
      setReviewedCount(newReviewed);
      setShowAnswer(false);

      if (currentIndex + 1 < sessionCards.length) {
        setCurrentIndex(currentIndex + 1);
      } else {
        if (isCustomPracticeMode && customPracticeFilters) {
          startReviewMutation.mutate({ custom: customPracticeFilters });
        } else {
          startReviewMutation.mutate({ practice: isPracticeMode });
        }
      }
    },
  });

  const buryMutation = useMutation({
    mutationFn: async (cardId: number) => {
      await apiRequest("POST", `/api/review/bury`, { cardId });
    },
    onSuccess: (_, cardId) => {
      queryClient.invalidateQueries({ queryKey: statsQueryKey });
      setShowAnswer(false);

      setSessionCards((prev) => {
        const remaining = prev.filter((c) => c.id !== cardId);
        if (remaining.length === 0) {
          setSessionActive(false);
        }
        return remaining;
      });

      setCurrentIndex((prev) => {
        const nextCardsCount = sessionCards.length - 1;
        if (nextCardsCount <= 0) return 0;
        return Math.min(prev, nextCardsCount - 1);
      });
    },
  });

  const unburyMutation = useMutation({
    mutationFn: async (card: CardWithVocabulary) => {
      await apiRequest("PATCH", `/api/vocabulary/${card.id}`, {
        buried: false,
      });
      return card;
    },
    onSuccess: (card) => {
      queryClient.invalidateQueries({ queryKey: statsQueryKey });

      setSessionCards((prev) => {
        const newCards = [...prev];
        newCards.splice(currentIndex, 0, card);
        return newCards;
      });

      toast({
        description: "Card restored to deck",
      });
    },
  });

  const editVocabMutation = useMutation({
    mutationFn: async ({
      vocabId,
      updates,
    }: {
      vocabId: number;
      updates: {
        simplified: string;
        pinyin: string;
        english: string;
        exampleSentence: string | null;
      };
    }) => {
      const res = await apiRequest(
        "PATCH",
        `/api/vocabulary/${vocabId}`,
        updates,
      );
      return res.json();
    },
    onSuccess: (data) => {
      if (data.vocabulary) {
        setSessionCards((prev) =>
          prev.map((c) => {
            if (c.vocabularyId === data.vocabulary.id) {
              return { ...c, vocabulary: data.vocabulary };
            }
            return c;
          }),
        );
      }
      queryClient.invalidateQueries({ queryKey: ["/api/vocabulary"] });
      setEditDialogOpen(false);
      toast({ description: "Card updated" });
    },
  });

  const playAudio = useCallback(async (text: string) => {
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
  }, []);

  useEffect(() => {
    if (
      showAnswer &&
      !prevShowAnswer.current &&
      autoPlayAudio &&
      sessionActive &&
      sessionCards.length > 0
    ) {
      const card = sessionCards[currentIndex];
      if (card) {
        playAudio(card.vocabulary.simplified);
      }
    }
    prevShowAnswer.current = showAnswer;
  }, [
    showAnswer,
    autoPlayAudio,
    sessionActive,
    sessionCards,
    currentIndex,
    playAudio,
  ]);

  const openEditDialog = useCallback((card: CardWithVocabulary) => {
    setEditFields({
      simplified: card.vocabulary.simplified,
      pinyin: card.vocabulary.pinyin,
      english: card.vocabulary.english,
      exampleSentence: card.vocabulary.exampleSentence || "",
    });
    setEditDialogOpen(true);
  }, []);

  if (statsLoading) {
    return (
      <div className="max-w-lg mx-auto px-4 py-8 space-y-6">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (sessionActive && !sessionCards.length) {
    setSessionActive(false);
  }

  if (!sessionActive && reviewedCount > 0) {
    return (
      <div className="max-w-lg mx-auto px-4 py-12">
        <Card className="p-8 text-center space-y-4">
          <CheckCircle2 className="w-16 h-16 mx-auto text-green-500" />
          <h2
            className="text-2xl font-bold"
            data-testid="text-session-complete"
          >
            Session Complete
          </h2>
          <p className="text-muted-foreground">
            You reviewed{" "}
            <span className="font-semibold text-foreground">
              {reviewedCount}
            </span>{" "}
            cards
          </p>
          <div className="flex flex-col gap-2 pt-4">
            {stats?.dueCount === 0 && (
              <Button
                onClick={() => {
                  if (isCustomPracticeMode && customPracticeFilters) {
                    startReviewMutation.mutate({ custom: customPracticeFilters });
                  } else {
                    startReviewMutation.mutate({ practice: isPracticeMode });
                  }
                }}
                data-testid="button-review-more"
              >
                Review More
              </Button>
            )}
            <Button
              variant="outline"
              onClick={() => {
                setReviewedCount(0);
              }}
              data-testid="button-back-home"
            >
              Back to Home
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  if (sessionActive && sessionCards.length > 0) {
    const card = sessionCards[currentIndex];
    const isRecognition = card.cardType === "Recognition";
    const progress = (currentIndex / sessionCards.length) * 100;

    return (
      <div className="max-w-lg mx-auto px-4 py-6 space-y-4">
        <div className="flex items-center justify-between gap-4">
          <span
            className="text-sm text-muted-foreground"
            data-testid="text-card-progress"
          >
            {currentIndex + 1} / {sessionCards.length}
          </span>
          <Progress value={progress} className="flex-1 h-2" />
          <div className="flex items-center gap-2 shrink-0">
            <Label
              htmlFor="auto-play-toggle"
              className="text-xs text-muted-foreground cursor-pointer select-none"
            >
              Auto-Play Audio
            </Label>
            <Switch
              id="auto-play-toggle"
              checked={autoPlayAudio}
              onCheckedChange={setAutoPlayAudio}
              data-testid="switch-auto-play"
            />
          </div>
          {isPracticeMode && (
            <Badge variant="secondary" className="text-xs shrink-0">
              Review More
            </Badge>
          )}
          {isCustomPracticeMode && (
            <Badge variant="secondary" className="text-xs shrink-0">
              Custom Practice
            </Badge>
          )}
        </div>

        <Card className="relative p-6 sm:p-8 text-center space-y-4">
          <div className="absolute top-2 right-2 flex items-center gap-1">
            <Button
              size="icon"
              variant="ghost"
              className="text-muted-foreground/50"
              onClick={() => openEditDialog(card)}
              title="Edit card"
              data-testid="button-edit-card"
            >
              <Pencil className="w-4 h-4" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="text-muted-foreground/50 hover:text-destructive"
              onClick={() => {
                const currentCard = card;
                buryMutation.mutate(currentCard.id, {
                  onSuccess: () => {
                    toast({
                      description: "Removed from deck",
                      action: (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => unburyMutation.mutate(currentCard)}
                          disabled={unburyMutation.isPending}
                        >
                          Undo
                        </Button>
                      ),
                    });
                  },
                });
              }}
              disabled={buryMutation.isPending}
              title="Remove from deck"
              data-testid="button-remove-card-top"
            >
              <EyeOff className="w-4 h-4" />
            </Button>
          </div>

          <div className="py-4 pt-8">
            {isRecognition ? (
              <div className="space-y-2">
                <p
                  className="text-5xl sm:text-6xl font-bold font-serif leading-tight"
                  data-testid="text-card-front"
                >
                  {card.vocabulary.simplified}
                </p>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => playAudio(card.vocabulary.simplified)}
                  data-testid="button-play-audio"
                >
                  <Volume2 className="w-5 h-5" />
                </Button>
              </div>
            ) : (
              <p
                className="text-2xl sm:text-3xl font-semibold"
                data-testid="text-card-front"
              >
                {card.vocabulary.english}
              </p>
            )}
          </div>

          <div
            className={`border-t pt-4 space-y-2 ${showAnswer ? "" : "invisible"}`}
          >
            {isRecognition ? (
              <>
                <p
                  className="text-lg text-muted-foreground"
                  data-testid="text-card-pinyin"
                >
                  {card.vocabulary.pinyin}
                </p>
                <p
                  className="text-xl font-semibold"
                  data-testid="text-card-answer"
                >
                  {card.vocabulary.english}
                </p>
              </>
            ) : (
              <>
                <p
                  className="text-4xl font-bold font-serif"
                  data-testid="text-card-answer"
                >
                  {card.vocabulary.simplified}
                </p>
                <p
                  className="text-lg text-muted-foreground"
                  data-testid="text-card-pinyin"
                >
                  {card.vocabulary.pinyin}
                </p>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => playAudio(card.vocabulary.simplified)}
                  data-testid="button-play-audio-answer"
                >
                  <Volume2 className="w-5 h-5" />
                </Button>
              </>
            )}
            {card.vocabulary.exampleSentence && (
              <p className="text-sm text-muted-foreground italic pt-2">
                {card.vocabulary.exampleSentence}
              </p>
            )}
          </div>
        </Card>

        {!showAnswer ? (
          <Button
            className="w-full h-14 text-lg font-bold"
            size="lg"
            onClick={() => setShowAnswer(true)}
            data-testid="button-show-answer"
          >
            Show Answer
          </Button>
        ) : isCustomPracticeMode ? (
          <Button
            className="w-full h-14 text-lg font-bold"
            size="lg"
            onClick={() => {
              setShowAnswer(false);
              if (currentIndex + 1 >= sessionCards.length) {
                setSessionActive(false);
                setReviewedCount(sessionCards.length);
              } else {
                setCurrentIndex(currentIndex + 1);
              }
            }}
            data-testid="button-next-custom"
          >
            {currentIndex + 1 >= sessionCards.length ? "Finish" : "Next →"}
          </Button>
        ) : (
          <div className="grid grid-cols-4 gap-2">
            {[
              {
                rating: 1 as ReviewRating,
                label: "Again",
                color: "bg-red-500 hover:bg-red-600 text-white",
              },
              {
                rating: 2 as ReviewRating,
                label: "Hard",
                color: "bg-orange-500 hover:bg-orange-600 text-white",
              },
              {
                rating: 3 as ReviewRating,
                label: "Good",
                color: "bg-green-500 hover:bg-green-600 text-white",
              },
              {
                rating: 4 as ReviewRating,
                label: "Easy",
                color: "bg-blue-500 hover:bg-blue-600 text-white",
              },
            ].map(({ rating, label, color }) => (
              <Button
                key={rating}
                className={`${color} h-14 font-bold no-default-hover-elevate no-default-active-elevate`}
                onClick={() => rateMutation.mutate({ cardId: card.id, rating })}
                disabled={rateMutation.isPending}
                data-testid={`button-rate-${label.toLowerCase()}`}
              >
                {label}
              </Button>
            ))}
          </div>
        )}

        <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Card</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label htmlFor="edit-simplified">Chinese (Simplified)</Label>
                <Input
                  id="edit-simplified"
                  value={editFields.simplified}
                  onChange={(e) =>
                    setEditFields((f) => ({ ...f, simplified: e.target.value }))
                  }
                  data-testid="input-edit-simplified"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-pinyin">Pinyin</Label>
                <Input
                  id="edit-pinyin"
                  value={editFields.pinyin}
                  onChange={(e) =>
                    setEditFields((f) => ({ ...f, pinyin: e.target.value }))
                  }
                  data-testid="input-edit-pinyin"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-english">English</Label>
                <Input
                  id="edit-english"
                  value={editFields.english}
                  onChange={(e) =>
                    setEditFields((f) => ({ ...f, english: e.target.value }))
                  }
                  data-testid="input-edit-english"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-example">Example Sentence</Label>
                <Input
                  id="edit-example"
                  value={editFields.exampleSentence}
                  onChange={(e) =>
                    setEditFields((f) => ({
                      ...f,
                      exampleSentence: e.target.value,
                    }))
                  }
                  data-testid="input-edit-example"
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setEditDialogOpen(false)}
                data-testid="button-edit-cancel"
              >
                Cancel
              </Button>
              <Button
                onClick={() => {
                  editVocabMutation.mutate({
                    vocabId: card.vocabulary.id,
                    updates: {
                      simplified: editFields.simplified,
                      pinyin: editFields.pinyin,
                      english: editFields.english,
                      exampleSentence: editFields.exampleSentence || null,
                    },
                  });
                }}
                disabled={editVocabMutation.isPending}
                data-testid="button-edit-save"
              >
                {editVocabMutation.isPending ? "Saving..." : "Save"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-6 space-y-4">
      <div className="text-center space-y-3">
        <h1
          className="relative flex items-baseline justify-center gap-2 text-2xl sm:text-4xl font-serif font-bold tracking-tight"
          data-testid="text-review-title"
        >
          <span>Daily Review</span>
          <div className="h-6 w-[2px] bg-primary rotate-12 mx-1 self-center" />
          <span>日常复习</span>
        </h1>
        <div className="max-w-[200px] mx-auto space-y-1.5">
          <Progress value={goalProgress} className="h-1.5" />
          <p className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground/60">
            Daily Progress: {stats?.reviewedToday ?? 0}/{dailyGoal} words
          </p>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-4 pt-2">
        <Card className="p-4 text-center space-y-2 border-none bg-red-50 dark:bg-red-950/20">
          <Target className="w-8 h-8 mx-auto text-red-600 fill-red-600" />
          <div>
            <p
              className="text-3xl font-black text-red-700 dark:text-red-500"
              data-testid="text-due-count"
            >
              {stats?.dueCount ?? 0}
            </p>
            <p className="text-[10px] font-bold uppercase tracking-wider text-red-600/70">
              Cards Due
            </p>
          </div>
        </Card>
        <Card className="p-4 text-center space-y-2 border-none bg-amber-50 dark:bg-amber-950/20">
          <Zap className="w-8 h-8 mx-auto text-amber-500 fill-amber-500" />
          <div>
            <p
              className="text-3xl font-black text-amber-600 dark:text-amber-500"
              data-testid="text-reviewed-today"
            >
              {stats?.reviewedToday ?? 0}
            </p>
            <p className="text-[10px] font-bold uppercase tracking-wider text-amber-600/70">cards reviewed</p>
          </div>
        </Card>
        <Card className="p-4 text-center space-y-2 border-none bg-orange-50 dark:bg-orange-950/20">
          <Flame className="w-8 h-8 mx-auto text-orange-500 fill-orange-500" />
          <div>
            <p
              className="text-3xl font-black text-orange-600 dark:text-orange-500"
              data-testid="text-streak-count"
            >
              {stats?.streak ?? 0}
            </p>
            <p className="text-[10px] font-bold uppercase tracking-wider text-orange-600/70">day streak</p>
          </div>
        </Card>
      </div>
      <div className="flex flex-col gap-3 pt-4">
        <Button
          size="lg"
          onClick={() => startReviewMutation.mutate({ practice: false })}
          disabled={
            !stats || stats.dueCount === 0 || startReviewMutation.isPending
          }
          className="w-full h-14 bg-[#8b3d30] hover:bg-[#723228] text-white font-bold text-lg shadow-lg shadow-red-100 dark:shadow-none transition-transform active:scale-95 hover:scale-105"
          data-testid="button-start-review"
        >
          <BookOpen className="w-6 h-6 mr-2" />
          {stats && stats.dueCount > 0
            ? `Start Review (${stats.dueCount})`
            : "No Cards Due"}
        </Button>
        {stats?.dueCount === 0 && (
          <Button
            variant="ghost"
            size="lg"
            onClick={() => startReviewMutation.mutate({ practice: true })}
            disabled={
              !stats || stats.totalCards === 0 || startReviewMutation.isPending
            }
            className="w-full h-12 border-2 border-transparent hover:border-muted font-bold text-muted-foreground transition-transform active:scale-95 hover:scale-105"
            data-testid="button-practice"
          >
            <RotateCcw className="w-5 h-5 mr-2" />
            Review More
          </Button>
        )}
        <Button
          variant="ghost"
          size="lg"
          onClick={() => setCustomPickerOpen(true)}
          disabled={
            !stats || stats.totalCards === 0 || startReviewMutation.isPending
          }
          className="w-full h-12 border-2 border-transparent hover:border-muted font-bold text-muted-foreground transition-transform active:scale-95 hover:scale-105"
          data-testid="button-custom-practice"
        >
          <ListFilter className="w-5 h-5 mr-2" />
          Custom Practice
        </Button>
      </div>
      {stats && stats.totalCards === 0 && (
        <Card className="p-6 text-center border-dashed">
          <p className="text-muted-foreground text-sm">
            No vocabulary loaded yet. Go to the Library to upload your CSV file.
          </p>
        </Card>
      )}
      <Dialog
        open={customPickerOpen}
        onOpenChange={(open) => {
          setCustomPickerOpen(open);
          if (!open) setSelectedSourceLessons({});
        }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Custom Practice</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Choose sources and lessons to review. This review session will not affect your FSRS schedule.
          </p>
          <div className="space-y-4 py-2 max-h-[60vh] overflow-y-auto">
            {Array.from(sourceLessonsMap.keys()).sort().map((source) => {
              const lessonsForSource = Array.from(sourceLessonsMap.get(source) ?? []).sort((a, b) => a - b);
              const isSourceSelected = source in selectedSourceLessons;
              const selectedLessonsForSource = selectedSourceLessons[source] ?? [];
              const isIndeterminate =
                lessonsForSource.length > 0 &&
                selectedLessonsForSource.length > 0 &&
                selectedLessonsForSource.length < lessonsForSource.length;
              return (
                <div key={source} className="space-y-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <Checkbox
                      checked={isSourceSelected}
                      indeterminate={isIndeterminate}
                      onCheckedChange={(checked) => {
                        setSelectedSourceLessons((prev) => {
                          const next = { ...prev };
                          if (checked) {
                            next[source] = [];
                          } else {
                            delete next[source];
                          }
                          return next;
                        });
                      }}
                    />
                    <span className="text-sm font-medium">
                      {source}
                      {lessonsForSource.length > 0 && (
                        <span className="text-muted-foreground font-normal"> (select for all lessons)</span>
                      )}
                    </span>
                  </label>
                  {lessonsForSource.length > 0 && (
                    <div
                      className="pl-6 grid grid-cols-3 gap-x-3 gap-y-1 grid-flow-col"
                      style={{
                        gridTemplateRows: `repeat(${Math.ceil(lessonsForSource.length / 3)}, auto)`,
                      }}
                    >
                      {lessonsForSource.map((lesson) => (
                        <label key={lesson} className="flex items-center gap-1.5 cursor-pointer">
                          <Checkbox
                            checked={
                              isSourceSelected &&
                              (selectedLessonsForSource.length === 0 || selectedLessonsForSource.includes(lesson))
                            }
                            onCheckedChange={(checked) => {
                              setSelectedSourceLessons((prev) => {
                                const next = { ...prev };
                                if (!(source in next)) next[source] = [];
                                const arr = next[source];
                                if (checked) {
                                  const newArr = arr.includes(lesson) ? arr : [...arr, lesson].sort((a, b) => a - b);
                                  const allSelected =
                                    newArr.length === lessonsForSource.length &&
                                    lessonsForSource.every((l) => newArr.includes(l));
                                  next[source] = allSelected ? [] : newArr;
                                } else {
                                  const newArr =
                                    arr.length === 0
                                      ? lessonsForSource.filter((l) => l !== lesson)
                                      : arr.filter((l) => l !== lesson);
                                  if (newArr.length === 0) {
                                    delete next[source];
                                  } else {
                                    next[source] = newArr;
                                  }
                                }
                                return next;
                              });
                            }}
                          />
                          <span className="text-sm">Lesson {lesson}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
            {sourceLessonsMap.size === 0 && (
              <p className="text-sm text-muted-foreground">No sources in your vocabulary.</p>
            )}
            <p className="text-sm font-medium pt-2">
              {(() => {
                const selectedSourcesList = Object.keys(selectedSourceLessons);
                const filtered = (words ?? []).filter((w) => {
                  const wSources = w.source || [];
                  const wLessons = w.lessonNumber || [];
                  for (const src of selectedSourcesList) {
                    if (!wSources.includes(src)) continue;
                    const selectedLessons = selectedSourceLessons[src];
                    const lessonsForSource = sourceLessonsMap.get(src);
                    if (selectedLessons.length === 0) return true;
                    if (!lessonsForSource?.size) return true;
                    for (let i = 0; i < wSources.length; i++) {
                      if (wSources[i] === src && wLessons[i] != null && selectedLessons.includes(wLessons[i])) return true;
                    }
                  }
                  return false;
                });
                return `${filtered.length} word${filtered.length !== 1 ? "s" : ""} (${filtered.length * 2} cards)`;
              })()}
            </p>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setCustomPickerOpen(false);
                setSelectedSourceLessons({});
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (Object.keys(selectedSourceLessons).length === 0) {
                  toast({ description: "Select at least one source.", variant: "destructive" });
                  return;
                }
                startReviewMutation.mutate({ custom: { sourceLessons: selectedSourceLessons } });
              }}
              disabled={startReviewMutation.isPending || Object.keys(selectedSourceLessons).length === 0}
              data-testid="button-start-custom-session"
            >
              {startReviewMutation.isPending ? "Loading..." : "Start Session"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
