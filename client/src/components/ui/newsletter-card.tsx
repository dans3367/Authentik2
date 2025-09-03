import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import illustrationUrl from "@assets/newsletter-illustration.svg";

// Newsletter illustration component
const NewsletterIllustration = () => (
  <img 
    src={illustrationUrl} 
    alt="Newsletter Team Illustration" 
    className="w-32 h-32 mx-auto object-contain"
  />
);

export function NewsletterCard() {
  const handleCreateTeam = () => {
    // Navigate to newsletter creation or team creation page
    // This can be customized based on your routing needs
    console.log("Create Team clicked");
  };

  return (
    <Card className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-3xl shadow-lg hover:shadow-xl transition-all duration-300 p-6">
      <CardContent className="p-0">
        <div className="text-center space-y-6">
          {/* Illustration */}
          <div className="pt-4">
            <NewsletterIllustration />
          </div>
          
          {/* Title */}
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 leading-tight">
            CREATE YOUR FIRST NEWSLETTER
          </h2>
          
          {/* Description */}
          <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed px-2">
            Enhance team formation and management with easy-to-use tools for communication, 
            task organization, and progress tracking, all in one place.
          </p>
          
          {/* Button */}
          <Button
            onClick={handleCreateTeam}
            className="bg-black hover:bg-gray-800 text-white px-6 py-3 rounded-xl font-medium transition-colors duration-200"
            size="lg"
          >
            Create Newsletter
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
