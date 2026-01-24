import { useLocation } from "wouter";
import { ArrowLeft, Construction } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NewsletterCreatePage() {
  const [, setLocation] = useLocation();

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setLocation("/newsletter")}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <h1 className="text-2xl font-bold">Create Newsletter</h1>
          </div>
        </div>
      </div>

      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-80px)] bg-background">
        <div className="text-center space-y-6 max-w-md px-4">
          <Construction className="h-24 w-24 mx-auto text-muted-foreground" />
          <h2 className="text-4xl font-bold">Under Construction</h2>
          <p className="text-muted-foreground text-lg">
            The newsletter editor is currently being developed.
          </p>
          <p className="text-sm text-muted-foreground">
            Please check back later for updates.
          </p>
        </div>
      </div>
    </div>
  );
}
