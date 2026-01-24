import { useState, useRef } from "react";
import { Wand2, Loader2 } from "lucide-react";
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
  makeMoreCasualText 
} from "@/lib/aiApi";
import { useToast } from "@/hooks/use-toast";

interface AITextareaProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export function AITextarea({ value, onChange, placeholder }: AITextareaProps) {
  const [selectedText, setSelectedText] = useState("");
  const [selectionRange, setSelectionRange] = useState<{ start: number; end: number } | null>(null);
  const [showAIMenu, setShowAIMenu] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { toast } = useToast();

  const handleTextSelection = () => {
    if (!textareaRef.current) return;

    const start = textareaRef.current.selectionStart;
    const end = textareaRef.current.selectionEnd;
    const selected = value.substring(start, end);

    if (selected.length > 0) {
      setSelectedText(selected);
      setSelectionRange({ start, end });
      
      // Calculate menu position
      const rect = textareaRef.current.getBoundingClientRect();
      setMenuPosition({
        top: rect.top - 60,
        left: rect.left + (rect.width / 2),
      });
      setShowAIMenu(true);
    } else {
      setShowAIMenu(false);
    }
  };

  const handleAITransform = async (action: string) => {
    if (!selectionRange) return;

    setIsLoading(true);
    try {
      let result;
      let transformedText;

      // Use specialized endpoints where available
      switch (action) {
        case "expand":
          result = await expandText({ text: selectedText });
          transformedText = result.expandedText;
          break;
        case "shorten":
          result = await shortenText({ text: selectedText });
          transformedText = result.shortenedText;
          break;
        case "formal":
          result = await makeMoreFormalText({ text: selectedText });
          transformedText = result.formalText;
          break;
        case "casual":
          result = await makeMoreCasualText({ text: selectedText });
          transformedText = result.casualText;
          break;
        case "grammar":
          result = await transformText({
            text: selectedText,
            prompt: "Fix any grammar and spelling errors in this text",
          });
          transformedText = result.text;
          break;
        case "simplify":
          result = await transformText({
            text: selectedText,
            prompt: "Simplify this text to make it easier to understand",
          });
          transformedText = result.text;
          break;
        default:
          throw new Error("Unknown action");
      }

      if (!result.success || !transformedText) {
        throw new Error(result.error || "Failed to transform text");
      }

      // Replace selected text with transformed text
      const newValue =
        value.substring(0, selectionRange.start) +
        transformedText +
        value.substring(selectionRange.end);

      onChange(newValue);
      setShowAIMenu(false);

      toast({
        title: "Text transformed",
        description: "Your text has been updated successfully",
      });
    } catch (error: any) {
      console.error("AI transformation error:", error);
      toast({
        title: "Transformation failed",
        description: error.message || "Failed to transform text",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const aiActions = [
    { label: "Make longer", action: "expand" },
    { label: "Make shorter", action: "shorten" },
    { label: "More formal", action: "formal" },
    { label: "Less formal", action: "casual" },
    { label: "Fix grammar", action: "grammar" },
    { label: "Simplify", action: "simplify" },
  ];

  return (
    <div className="relative">
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onSelect={handleTextSelection}
        onMouseUp={handleTextSelection}
        placeholder={placeholder}
        className="w-full min-h-[120px] px-3 py-2 text-sm rounded-md border border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 resize-y"
        rows={4}
      />

      {showAIMenu && (
        <div
          className="fixed z-50"
          style={{
            top: `${menuPosition.top}px`,
            left: `${menuPosition.left}px`,
            transform: "translateX(-50%)",
          }}
        >
          <Popover open={showAIMenu} onOpenChange={setShowAIMenu}>
            <PopoverTrigger asChild>
              <Button
                variant="default"
                size="sm"
                className="shadow-lg bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
              >
                <Wand2 className="h-4 w-4 mr-2" />
                AI Assistant
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64 p-2" align="center">
              <div className="space-y-1">
                <div className="text-xs font-semibold text-muted-foreground px-2 py-1">
                  Transform text
                </div>
                {aiActions.map((action) => (
                  <Button
                    key={action.label}
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start text-sm"
                    onClick={() => handleAITransform(action.action)}
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <Loader2 className="h-3 w-3 mr-2 animate-spin" />
                    ) : (
                      <Wand2 className="h-3 w-3 mr-2" />
                    )}
                    {action.label}
                  </Button>
                ))}
              </div>
            </PopoverContent>
          </Popover>
        </div>
      )}
    </div>
  );
}
