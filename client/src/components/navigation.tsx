import { Link, useLocation } from "wouter";
import { BookOpen, Newspaper, Library, Settings, Sun, Moon, Flame } from "lucide-react";
import { useTheme } from "./theme-provider";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import type { ReviewStats } from "@shared/schema";

export function Navigation() {
  const [location] = useLocation();
  const { theme, toggleTheme } = useTheme();

  const tzOffset = new Date().getTimezoneOffset();
  const { data: stats } = useQuery<ReviewStats>({
    queryKey: [`/api/review/stats?tzOffset=${tzOffset}`],
  });

  const navItems = [
    { path: "/", label: "Review", icon: BookOpen },
    { path: "/news", label: "News", icon: Newspaper },
    { path: "/library", label: "Library", icon: Library },
    { path: "/settings", label: "Settings", icon: Settings },
  ];

  const dailyGoal = 20;
  const cardsDueCount = stats ? Math.max(0, dailyGoal - stats.reviewedToday) : 0;

  return (
    <header className="sticky top-0 z-50 w-full left-0 right-0 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="flex items-center justify-between gap-2 px-2 sm:px-4 h-14 max-w-5xl mx-auto overflow-hidden">
        <Link href="/" className="flex items-center gap-1.5 shrink-0" data-testid="link-home" onClick={() => {
          if (location === "/") window.dispatchEvent(new CustomEvent("resetReview"));
        }}>
          <span className="text-lg sm:text-xl font-bold text-primary font-serif tracking-tight truncate max-w-[120px] sm:max-w-none">Chinese Tutor</span>
        </Link>

        <nav className="flex items-center gap-0.5 sm:gap-1 overflow-x-auto no-scrollbar py-1">
          {navItems.map((item) => {
            const isActive = location === item.path || 
              (item.path !== "/" && location.startsWith(item.path));
            const Icon = item.icon;
            return (
              <Link key={item.path} href={item.path} onClick={() => {
                if (item.path === "/" && location === "/") window.dispatchEvent(new CustomEvent("resetReview"));
              }}>
                <Button
                  variant={isActive ? "secondary" : "ghost"}
                  size="sm"
                  className="gap-1 sm:gap-1.5 px-2 sm:px-3 h-8 sm:h-9"
                  data-testid={`nav-${item.label.toLowerCase()}`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span className="hidden md:inline text-xs sm:text-sm">{item.label}</span>
                </Button>
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 h-8 sm:h-9">
          {stats && (
            <Link href="/" className="shrink-0 flex items-center">
              <Badge variant="default" className="text-[10px] sm:text-xs cursor-pointer hover-elevate active-elevate-2 px-1.5 py-0 h-5 sm:h-5.5 flex items-center justify-center" data-testid="badge-due-count">
                {cardsDueCount}<span className="hidden xs:inline ml-1">due</span>
              </Badge>
            </Link>
          )}
          {stats && stats.streak > 0 && (
            <div className="flex items-center gap-0.5 sm:gap-1 text-xs sm:text-sm text-accent shrink-0 h-full" data-testid="text-streak">
              <Flame className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span className="font-semibold">{stats.streak}</span>
            </div>
          )}
          <Button
            size="icon"
            variant="ghost"
            onClick={toggleTheme}
            className="h-8 w-8 sm:h-9 sm:w-9 shrink-0"
            data-testid="button-theme-toggle"
          >
            {theme === "light" ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
          </Button>
        </div>
      </div>
    </header>
  );
}
