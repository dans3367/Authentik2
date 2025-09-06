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
    <Card className="bg-white dark:bg-gray-800 rounded-xl h-full">
      <CardContent className="p-8">
        <div className="text-center space-y-6 flex flex-col justify-center h-full">
          {/* Illustration */}
          <div>
            <img 
              src={NewsletterIllustration} 
              alt="Newsletter Illustration" 
              className="w-32 h-32 mx-auto"
            />
          </div>
          
          {/* Title */}
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 leading-tight">
          Let’s Build Your First Newsletter
          </h2>
          
          {/* Description */}
          <p className="text-gray-600 dark:text-gray-400 leading-relaxed max-w-md mx-auto">
          With just a few steps, you can design and send professional newsletters that reach your audience directly in their inbox.
          </p>
          
          {/* Button */}
          <Button
            onClick={handleCreateNewsletter}
            className="bg-black hover:bg-gray-800 text-white px-8 py-3 rounded-lg font-medium transition-colors duration-200 mx-auto"
            size="lg"
          >
            Create Newsletter
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
