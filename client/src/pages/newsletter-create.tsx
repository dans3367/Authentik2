import { NewsletterEditor } from "@/components/NewsletterEditor";
import { NewsletterBlock } from "@/types/newsletter-editor";
import { useToast } from "@/hooks/use-toast";

export default function NewsletterCreatePage() {
  const { toast } = useToast();

  const handleSave = (blocks: NewsletterBlock[]) => {
    console.log('Saving newsletter blocks:', blocks);
    toast({
      title: "Newsletter Saved",
      description: "Your newsletter has been saved successfully.",
    });
  };

  return <NewsletterEditor onSave={handleSave} />;
}
