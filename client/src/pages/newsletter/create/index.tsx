import { Construction } from "lucide-react";

export default function NewsletterCreatePage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background">
      <div className="text-center space-y-6 max-w-md px-4">
        <Construction className="h-24 w-24 mx-auto text-muted-foreground" />
        <h1 className="text-4xl font-bold">Under Construction</h1>
        <p className="text-muted-foreground text-lg">
          The newsletter creation page is currently being developed.
        </p>
        <p className="text-sm text-muted-foreground">
          Please check back later for updates.
        </p>
      </div>
    </div>
  );
}
