import { useState } from "react";
import { Sparkles, Loader2, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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

interface TextFieldWithAIHelperProps {
  value: string;
  onChange: (value: string) => void;
}

export function TextFieldWithAIHelper({ value, onChange }: TextFieldWithAIHelperProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [showAIMenu, setShowAIMenu] = useState(false);
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [generatePrompt, setGeneratePrompt] = useState("");
  const { toast } = useToast();

  const handleAIAction = async (action: string) => {
    // If Generate is clicked and text is empty, show modal
    if (action === "generate" && (!value || value.trim().length === 0)) {
      setShowAIMenu(false);
      setShowGenerateModal(true);
      return;
    }

    setIsLoading(true);
    setShowAIMenu(false);

    try {
      let result;
      let transformedText;

      if (action === "generate") {
        // Generate new text with default prompt (when text already exists)
        result = await transformText({
          text: "[Generate new content]",
          prompt: "Write a compelling newsletter text paragraph about a product or service. Make it engaging, professional, and around 2-3 sentences. Ignore the placeholder text and create entirely new content.",
        });
        transformedText = result.text;
      } else {
        // Transform existing text
        if (!value || value.trim().length === 0) {
          toast({
            title: "No text to transform",
            description: "Please add some text first before transforming it",
            variant: "destructive",
          });
          setIsLoading(false);
          return;
        }

        switch (action) {
          case "expand":
            result = await expandText({ text: value });
            transformedText = result.expandedText;
            break;
          case "shorten":
            result = await shortenText({ text: value });
            transformedText = result.shortenedText;
            break;
          case "formal":
            result = await makeMoreFormalText({ text: value });
            transformedText = result.formalText;
            break;
          case "casual":
            result = await makeMoreCasualText({ text: value });
            transformedText = result.casualText;
            break;
          case "grammar":
            result = await transformText({
              text: value,
              prompt: "Fix any grammar and spelling errors in this text",
            });
            transformedText = result.text;
            break;
          case "simplify":
            result = await transformText({
              text: value,
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

      onChange(transformedText);

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

  const handleGenerate = async () => {
    if (!generatePrompt.trim()) {
      toast({
        title: "Prompt required",
        description: "Please describe what text you want to generate",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    setShowGenerateModal(false);

    try {
      const result = await transformText({
        text: "[Generate new content]",
        prompt: `Write newsletter content based on this request: ${generatePrompt}. Make it engaging and professional. Ignore the placeholder text and create entirely new content.`,
      });

      if (!result.success || !result.text) {
        throw new Error(result.error || "Failed to generate text");
      }

      onChange(result.text);
      setGeneratePrompt(""); // Reset prompt

      toast({
        title: "Text generated",
        description: "Your content has been generated successfully",
      });
    } catch (error: any) {
      console.error("Generate error:", error);
      toast({
        title: "Generation failed",
        description: error.message || "Failed to generate text",
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
    <div className="space-y-2">
      {/* AI Helper Button - Always visible next to Page Text field */}
      <div className="flex items-center justify-between">
        <Popover open={showAIMenu} onOpenChange={setShowAIMenu}>
          <PopoverTrigger asChild>
            <Button
              variant="secondary"
              size="sm"
              className="h-8 gap-1.5 text-xs"
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
          <PopoverContent className="w-64 p-2" align="start">
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

      {/* Textarea */}
      <Textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Enter your text content here..."
        className="min-h-[120px] resize-y"
      />

      {/* Generate Modal */}
      <Dialog open={showGenerateModal} onOpenChange={setShowGenerateModal}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Generate Text with AI</DialogTitle>
            <DialogDescription>
              Describe what kind of text you want to generate for your newsletter.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="generate-prompt">What would you like to generate?</Label>
              <Textarea
                id="generate-prompt"
                placeholder="e.g., A welcome message for new subscribers, product announcement, company update..."
                value={generatePrompt}
                onChange={(e) => setGeneratePrompt(e.target.value)}
                className="min-h-[100px]"
                disabled={isLoading}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowGenerateModal(false);
                setGeneratePrompt("");
              }}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button
              onClick={handleGenerate}
              disabled={isLoading || !generatePrompt.trim()}
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Generate
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
