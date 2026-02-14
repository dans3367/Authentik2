import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import NewsletterIllustration from "../../../../attached_assets/28.svg";

export function NewsletterCard() {
  const [, setLocation] = useLocation();

  const handleCreateNewsletter = () => {
    setLocation("/newsletter/create");
  };

  return (
    <Card className="h-full">
      <CardContent className="p-8">
        <div className="text-center space-y-6 flex flex-col justify-center h-full">
          <div className="mx-auto w-24 h-24 rounded-2xl bg-muted flex items-center justify-center">
            <img
              src={NewsletterIllustration}
              alt="Newsletter Illustration"
              className="w-14 h-14"
            />
          </div>

          <h2 className="text-2xl font-bold leading-tight tracking-tight">
            Let’s Build Your First Newsletter
          </h2>

          <p className="text-muted-foreground leading-relaxed max-w-md mx-auto">
            With just a few steps, you can design and send professional newsletters that reach your audience directly in their inbox.
          </p>

          <Button
            onClick={handleCreateNewsletter}
            size="lg"
            className="mx-auto"
            data-testid="button-create-newsletter"
          >
            Create Newsletter
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
