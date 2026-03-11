import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import { Navigation } from "@/components/navigation";
import ReviewPage from "@/pages/review";
import NewsPage from "@/pages/news";
import LibraryPage from "@/pages/library";
import SettingsPage from "@/pages/settings";
import NotFound from "@/pages/not-found";
import { useEffect } from "react";

function Router() {
  return (
    <Switch>
      <Route path="/" component={ReviewPage} />
      <Route path="/review" component={ReviewPage} />
      <Route path="/news" component={NewsPage} />
      <Route path="/library" component={LibraryPage} />
      <Route path="/settings" component={SettingsPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function AppContent() {
  const queryClient = useQueryClient();

  useEffect(() => {
    // Background prefetch news feeds on mount
    // Skip if on metered connection if supported
    const connection = (navigator as any).connection;
    if (connection?.saveData) return;

    queryClient.prefetchQuery({
      queryKey: ["/api/news/feeds"],
      staleTime: 5 * 60 * 1000,
    });
  }, [queryClient]);

  return (
    <ThemeProvider>
      <TooltipProvider>
        <div className="min-h-screen bg-background text-foreground flex flex-col">
          <Navigation />
          <main className="flex-1 w-full">
            <Router />
          </main>
        </div>
        <Toaster />
      </TooltipProvider>
    </ThemeProvider>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppContent />
    </QueryClientProvider>
  );
}

export default App;
