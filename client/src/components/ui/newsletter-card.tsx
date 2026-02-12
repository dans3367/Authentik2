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
    <Card className="bg-white/80 dark:bg-gray-900/60 backdrop-blur rounded-2xl h-full border border-gray-100/80 dark:border-gray-800/60 shadow-sm hover:shadow-md transition-shadow">
      <CardContent className="p-8">
        <div className="text-center space-y-6 flex flex-col justify-center h-full">
          <div className="mx-auto w-24 h-24 rounded-2xl bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-blue-900/40 dark:via-gray-900 dark:to-purple-900/30 flex items-center justify-center ring-1 ring-gray-100/80 dark:ring-gray-800/60">
            <img 
              src={NewsletterIllustration} 
              alt="Newsletter Illustration" 
              className="w-14 h-14"
            />
          </div>
          
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 leading-tight">
            Let’s Build Your First Newsletter
          </h2>
          
          <p className="text-gray-600 dark:text-gray-400 leading-relaxed max-w-md mx-auto">
            With just a few steps, you can design and send professional newsletters that reach your audience directly in their inbox.
          </p>
          
          <Button
            onClick={handleCreateNewsletter}
            className="bg-gradient-to-r from-gray-900 to-gray-800 hover:from-gray-800 hover:to-gray-700 dark:from-white dark:to-gray-200 dark:text-gray-900 text-white px-8 py-3 rounded-lg font-medium transition-all duration-200 mx-auto shadow-sm hover:shadow"
            size="lg"
          >
            Create Newsletter
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
