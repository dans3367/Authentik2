import { useState } from "react";
import { Sparkles, Loader2, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  transformText,
  expandText,
  shortenText,
  makeMoreFormalText,
  makeMoreCasualText,
} from "@/lib/aiApi";
import { useToast } from "@/hooks/use-toast";

interface TextComponentWithAIProps {
  content: string;
  align: string;
  puck: {
    isEditing: boolean;
  };
  onChange?: (content: string) => void;
}

export function TextComponentWithAI({ content, align, puck, onChange }: TextComponentWithAIProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [showAIMenu, setShowAIMenu] = useState(false);
  const { toast } = useToast();

  const handleAIAction = async (action: string) => {
    setIsLoading(true);
    setShowAIMenu(false);

    try {
      let result;
      let transformedText;

      if (action === "generate") {
        // Generate new text
        result = await transformText({
          text: "",
          prompt: "Write a compelling newsletter text paragraph about a product or service. Make it engaging, professional, and around 2-3 sentences.",
        });
        transformedText = result.text;
      } else {
        // Transform existing text
        if (!content || content.trim().length === 0) {
          toast({
            title: "No text to transform",
            description: "Please add some text first before transforming it",
            variant: "destructive",
          });
          return;
        }

        switch (action) {
          case "expand":
            result = await expandText({ text: content });
            transformedText = result.expandedText;
            break;
          case "shorten":
            result = await shortenText({ text: content });
            transformedText = result.shortenedText;
            break;
          case "formal":
            result = await makeMoreFormalText({ text: content });
            transformedText = result.formalText;
            break;
          case "casual":
            result = await makeMoreCasualText({ text: content });
            transformedText = result.casualText;
            break;
          case "grammar":
            result = await transformText({
              text: content,
              prompt: "Fix any grammar and spelling errors in this text",
            });
            transformedText = result.text;
            break;
          case "simplify":
            result = await transformText({
              text: content,
              prompt: "Simplify this text to make it easier to understand",
            });
            transformedText = result.text;
            break;
          default:
            throw new Error("Unknown action");
        }
      }

      if (!result.success || !transformedText) {
        throw new Error(result.error || "Failed to process text");
      }

      // Update content via Puck's onChange
      if (onChange) {
        onChange(transformedText);
      }

      toast({
        title: action === "generate" ? "Text generated" : "Text transformed",
        description:
          action === "generate"
            ? "New text has been generated successfully"
            : "Your text has been updated successfully",
      });
    } catch (error: any) {
      console.error("AI action error:", error);
      toast({
        title: "Action failed",
        description: error.message || "Failed to process text",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const aiActions = [
    { label: "Generate", action: "generate", icon: Sparkles },
    { label: "Make longer", action: "expand", icon: Wand2 },
    { label: "Make shorter", action: "shorten", icon: Wand2 },
    { label: "More formal", action: "formal", icon: Wand2 },
    { label: "Less formal", action: "casual", icon: Wand2 },
    { label: "Fix grammar", action: "grammar", icon: Wand2 },
    { label: "Simplify", action: "simplify", icon: Wand2 },
  ];

  return (
    <div className="relative group">
      <p className={`text-${align} mb-4 leading-relaxed text-base`}>{content}</p>

      {/* AI Helper Button - Shows when component is being edited */}
      {puck.isEditing && (
        <div className="absolute -top-10 right-0 opacity-0 group-hover:opacity-100 transition-opacity">
          <Popover open={showAIMenu} onOpenChange={setShowAIMenu}>
            <PopoverTrigger asChild>
              <Button
                variant="secondary"
                size="sm"
                className="h-8 gap-1.5 text-xs shadow-md"
                disabled={isLoading}
              >
                {isLoading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Sparkles className="h-3.5 w-3.5" />
                )}
                AI Helper
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64 p-2" align="end">
              <div className="space-y-1">
                <div className="text-xs font-semibold text-muted-foreground px-2 py-1">
                  AI Actions
                </div>
                {aiActions.map((action) => {
                  const Icon = action.icon;
                  return (
                    <Button
                      key={action.action}
                      variant="ghost"
                      size="sm"
                      className="w-full justify-start text-sm"
                      onClick={() => handleAIAction(action.action)}
                      disabled={isLoading}
                    >
                      <Icon className="h-3 w-3 mr-2" />
                      {action.label}
                    </Button>
                  );
                })}
              </div>
            </PopoverContent>
          </Popover>
        </div>
      )}
    </div>
  );
}
