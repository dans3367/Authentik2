import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { Newspaper, ArrowRight, Sparkles, Send } from "lucide-react";

export function NewsletterCard() {
  const [, setLocation] = useLocation();

  const handleCreateNewsletter = () => {
    setLocation("/newsletter/create");
  };

  return (
    <Card className="h-full group relative overflow-hidden border-0 shadow-md hover:shadow-lg transition-shadow duration-300">
      {/* Gradient background */}
      <div className="absolute inset-0 bg-gradient-to-br from-blue-600 via-indigo-600 to-violet-600 dark:from-blue-700 dark:via-indigo-700 dark:to-violet-700" />

      {/* Decorative floating shapes */}
      <div className="absolute top-6 right-8 w-20 h-20 rounded-full bg-white/10 blur-xl group-hover:scale-125 transition-transform duration-500" />
      <div className="absolute bottom-4 left-1/4 w-16 h-16 rounded-full bg-white/5 blur-lg group-hover:translate-y-[-8px] transition-transform duration-500" />
      <div className="absolute top-1/2 right-1/4 w-8 h-8 rounded-full bg-white/10 blur-sm group-hover:scale-150 transition-transform duration-700" />

      {/* Pattern overlay */}
      <div className="absolute inset-0 opacity-[0.03]" style={{
        backgroundImage: `radial-gradient(circle at 1px 1px, white 1px, transparent 0)`,
        backgroundSize: '24px 24px'
      }} />

      <CardContent className="relative p-6 sm:p-8 flex flex-col justify-center h-full min-h-[260px]">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
          {/* Icon & Content */}
          <div className="flex-1 space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/15 backdrop-blur-sm text-white/90 text-xs font-medium">
              <Sparkles className="w-3.5 h-3.5" />
              Get Started
            </div>

            <h2 className="text-2xl sm:text-3xl font-bold text-white leading-tight tracking-tight">
              Build Your First<br className="hidden sm:block" /> Newsletter
            </h2>

            <p className="text-white/75 text-sm sm:text-base leading-relaxed max-w-md">
              Design and send professional newsletters that reach your audience
              directly in their inbox — in just a few steps.
            </p>

            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <Button
                onClick={handleCreateNewsletter}
                size="lg"
                className="bg-white text-indigo-700 hover:bg-white/90 font-semibold shadow-lg hover:shadow-xl transition-all duration-200 group/btn"
                data-testid="button-create-newsletter"
              >
                <Newspaper className="w-4 h-4 mr-2" />
                Create Newsletter
                <ArrowRight className="w-4 h-4 ml-2 group-hover/btn:translate-x-1 transition-transform" />
              </Button>
              <Button
                onClick={() => setLocation("/newsletter")}
                variant="ghost"
                size="lg"
                className="text-white/80 hover:text-white hover:bg-white/10 font-medium"
              >
                <Send className="w-4 h-4 mr-2" />
                View All
              </Button>
            </div>
          </div>

          {/* Decorative illustration replacement */}
          <div className="hidden lg:flex flex-col items-center justify-center">
            <div className="relative w-36 h-36">
              {/* Outer ring */}
              <div className="absolute inset-0 rounded-2xl bg-white/10 backdrop-blur-sm rotate-6 group-hover:rotate-12 transition-transform duration-500" />
              {/* Inner card */}
              <div className="absolute inset-2 rounded-xl bg-white/15 backdrop-blur-md flex flex-col items-center justify-center gap-2 -rotate-3 group-hover:rotate-0 transition-transform duration-500">
                <Newspaper className="w-10 h-10 text-white/80" />
                <div className="flex gap-1">
                  <div className="w-8 h-1 rounded-full bg-white/40" />
                  <div className="w-5 h-1 rounded-full bg-white/25" />
                </div>
                <div className="flex gap-1">
                  <div className="w-5 h-1 rounded-full bg-white/30" />
                  <div className="w-8 h-1 rounded-full bg-white/20" />
                </div>
                <div className="w-10 h-1 rounded-full bg-white/15 mt-1" />
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
