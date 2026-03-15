import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useTheme } from "@/components/theme-provider";
import { Sun, Moon, Save, X, Plus } from "lucide-react";
import type { ReviewStats } from "@shared/schema";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

export default function SettingsPage() {
  const { theme, toggleTheme } = useTheme();
  const { toast } = useToast();

  const tzOffset = new Date().getTimezoneOffset();
  const statsQueryKey = [`/api/review/stats?tzOffset=${tzOffset}`];

  const { data: stats, isLoading } = useQuery<ReviewStats>({
    queryKey: statsQueryKey,
  });

  const [maxNew, setMaxNew] = useState(5);
  const [maxDue, setMaxDue] = useState(30);
  const [priorityKeywords, setPriorityKeywords] = useState<string[]>([]);
  const [newKeyword, setNewKeyword] = useState("");
  const [defaultFontSize, setDefaultFontSize] = useState(() => {
    const stored = localStorage.getItem("reader_font_size");
    return stored ? parseInt(stored, 10) : 18;
  });
  const [defaultLineHeight, setDefaultLineHeight] = useState(() => {
    const stored = localStorage.getItem("reader_line_height");
    return stored ? parseFloat(stored) : 1.8;
  });

  useEffect(() => {
    if (stats) {
      setMaxNew(stats.maxNewPerDay);
      setMaxDue(stats.maxDuePerDay);
      setPriorityKeywords(stats.priorityKeywords || []);
    }
  }, [stats]);

  const saveSettingsMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/settings", {
        maxNewCardsPerDay: maxNew,
        maxDueCardsPerDay: maxDue,
        priorityKeywords: priorityKeywords,
      });
    },
    onSuccess: () => {
      localStorage.setItem("reader_font_size", defaultFontSize.toString());
      localStorage.setItem("reader_line_height", defaultLineHeight.toString());
      queryClient.invalidateQueries({ queryKey: statsQueryKey });
      queryClient.invalidateQueries({ queryKey: ["/api/news/feeds"] });
      toast({ title: "Settings Saved" });
    },
  });

  const addKeyword = () => {
    if (newKeyword && !priorityKeywords.includes(newKeyword)) {
      setPriorityKeywords([...priorityKeywords, newKeyword]);
      setNewKeyword("");
    }
  };

  const removeKeyword = (kw: string) => {
    setPriorityKeywords(priorityKeywords.filter(k => k !== kw));
  };

  if (isLoading) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-6 space-y-4">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      <div className="flex flex-col lg:flex-row lg:gap-6">
        <main className="flex-1 min-w-0 space-y-6 max-w-lg">
          <div>
            <h1 className="relative flex items-baseline gap-2 text-2xl sm:text-4xl font-serif font-bold tracking-tight" data-testid="text-settings-title">
              <span>Settings</span>
              <div className="h-6 w-[2px] bg-primary rotate-12 mx-1 self-center" />
              <span>设置</span>
            </h1>
            <p className="text-sm text-muted-foreground">Configure your learning experience</p>
          </div>

          <Card className="p-5 space-y-5">
            <h2 className="font-semibold">Review Settings</h2>
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Max new cards per day</span>
                  <span className="font-medium">{maxNew}</span>
                </div>
                <Slider
                  value={[maxNew]}
                  onValueChange={([v]) => setMaxNew(v)}
                  min={1}
                  max={30}
                  step={1}
                  data-testid="slider-max-new"
                />
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Max due cards per session</span>
                  <span className="font-medium">{maxDue}</span>
                </div>
                <Slider
                  value={[maxDue]}
                  onValueChange={([v]) => setMaxDue(v)}
                  min={5}
                  max={100}
                  step={5}
                  data-testid="slider-max-due"
                />
              </div>
            </div>
          </Card>

          <Card className="p-5 space-y-5">
            <h2 className="font-semibold text-foreground">News Interests</h2>
            <div className="space-y-4">
              <p className="text-xs text-muted-foreground">
                Articles containing these keywords will be prioritized in your news feed.
              </p>
              <div className="flex flex-wrap gap-2">
                {priorityKeywords.map((kw) => (
                  <Badge key={kw} variant="secondary" className="gap-1 pr-1 bg-amber-100 text-amber-900 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-900/50">
                    {kw}
                    <button
                      onClick={() => removeKeyword(kw)}
                      className="hover:text-destructive transition-colors"
                      data-testid={`button-remove-keyword-${kw}`}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </Badge>
                ))}
              </div>
              <div className="flex gap-2">
                <Input
                  placeholder="Add keyword (e.g. 科技)"
                  value={newKeyword}
                  onChange={(e) => setNewKeyword(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addKeyword()}
                  className="h-9"
                  data-testid="input-new-keyword"
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={addKeyword}
                  className="shrink-0"
                  data-testid="button-add-keyword"
                >
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </Card>

          <Card className="p-5 space-y-5">
            <h2 className="font-semibold">Appearance</h2>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Theme</p>
                <p className="text-xs text-muted-foreground">Switch between light and dark mode</p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={toggleTheme}
                className="gap-2"
                data-testid="button-toggle-theme"
              >
                {theme === "light" ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
                {theme === "light" ? "Dark" : "Light"}
              </Button>
            </div>
            <div className="space-y-4 pt-2 border-t">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Default font size</span>
                  <span className="font-medium">{defaultFontSize} px</span>
                </div>
                <Slider
                  value={[defaultFontSize]}
                  onValueChange={([v]) => setDefaultFontSize(v)}
                  min={14}
                  max={28}
                  step={1}
                  data-testid="slider-default-font-size"
                />
                <p className="text-xs text-muted-foreground">Used when reading news articles</p>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Default line height</span>
                  <span className="font-medium">{defaultLineHeight.toFixed(1)}</span>
                </div>
                <Slider
                  value={[defaultLineHeight * 10]}
                  onValueChange={([v]) => setDefaultLineHeight(v / 10)}
                  min={14}
                  max={28}
                  step={1}
                  data-testid="slider-default-line-height"
                />
                <p className="text-xs text-muted-foreground">Used when reading news articles</p>
              </div>
            </div>
          </Card>

          <div className="flex justify-end pt-2">
            <Button
              onClick={() => saveSettingsMutation.mutate()}
              disabled={saveSettingsMutation.isPending}
              size="lg"
              className="shadow-lg gap-2 bg-[#8b3d30] hover:bg-[#723228] text-white font-bold"
              data-testid="button-save-settings"
            >
              <Save className="w-4 h-4" />
              {saveSettingsMutation.isPending ? "Saving..." : "Save Settings"}
            </Button>
          </div>
        </main>

        <aside className="w-full lg:w-56 shrink-0 pt-6 lg:pt-20">
          <Card className="p-5 space-y-2">
            <h2 className="font-semibold">Statistics</h2>
            <div className="grid grid-cols-2 lg:grid-cols-1 gap-3 text-sm">
              <div>
                <p className="text-muted-foreground">Total Cards</p>
                <p className="text-lg font-semibold" data-testid="text-total-cards">{stats?.totalCards ?? 0}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Cards Due</p>
                <p className="text-lg font-semibold" data-testid="text-cards-due">{stats?.dueCount ?? 0}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Reviewed Today</p>
                <p className="text-lg font-semibold" data-testid="text-reviewed-today">{stats?.reviewedToday ?? 0}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Current Streak</p>
                <p className="text-lg font-semibold" data-testid="text-current-streak">{stats?.streak ?? 0}</p>
              </div>
            </div>
          </Card>
        </aside>
      </div>
    </div>
  );
}
