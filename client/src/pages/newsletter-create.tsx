import { useState } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, Save } from "lucide-react";
import { PuckNewsletterEditor } from "@/components/PuckNewsletterEditor";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

export default function NewsletterCreatePage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [newsletterData, setNewsletterData] = useState<any>(null);

  const handleSave = () => {
    if (!newsletterData) {
      toast({
        title: "No content",
        description: "Please add some content to your newsletter",
        variant: "destructive",
      });
      return;
    }

    // TODO: Save newsletter data to backend
    console.log("Saving newsletter:", newsletterData);
    
    toast({
      title: "Saved!",
      description: "Newsletter has been saved successfully",
    });
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
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
            <Button onClick={handleSave}>
              <Save className="h-4 w-4 mr-2" />
              Save Newsletter
            </Button>
          </div>
        </div>
      </div>

      <div className="w-full">
        <PuckNewsletterEditor
          initialData={newsletterData}
          onChange={setNewsletterData}
        />
      </div>
    </div>
  );
}
