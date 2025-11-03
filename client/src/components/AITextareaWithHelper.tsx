import { useState, useRef } from "react";
import { Wand2, Loader2, Sparkles } from "lucide-react";
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

interface AITextareaWithHelperProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export function AITextareaWithHelper({ value, onChange, placeholder }: AITextareaWithHelperProps) {
  const [selectedText, setSelectedText] = useState("");
  const [selectionRange, setSelectionRange] = useState<{ start: number; end: number } | null>(null);
  const [showAIMenu, setShowAIMenu] = useState(false);
  const [showHelperMenu, setShowHelperMenu] = useState(false);
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

  const handleHelperAction = async (action: string) => {
    setIsLoading(true);
    setShowHelperMenu(false);
    
    try {
      let result;
      let transformedText;

      if (action === "generate") {
        // Generate new text from scratch
        result = await transformText({
          text: "",
          prompt: "Write a compelling newsletter text paragraph about a product or service. Make it engaging, professional, and around 2-3 sentences.",
        });
        transformedText = result.text;
        
        // Replace entire content
        if (result.success && transformedText) {
          onChange(transformedText);
        }
      } else {
        // Transform existing text
        if (!value || value.trim().length === 0) {
          toast({
            title: "No text to transform",
            description: "Please add some text first before transforming it",
            variant: "destructive",
          });
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

        if (result.success && transformedText) {
          onChange(transformedText);
        }
      }

      if (!result.success || !transformedText) {
        throw new Error(result.error || "Failed to process text");
      }

      toast({
        title: action === "generate" ? "Text generated" : "Text transformed",
        description: action === "generate" 
          ? "New text has been generated successfully" 
          : "Your text has been updated successfully",
      });
    } catch (error: any) {
      console.error("AI helper error:", error);
      toast({
        title: "Action failed",
        description: error.message || "Failed to process text",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const selectionActions = [
    { label: "Make longer", action: "expand" },
    { label: "Make shorter", action: "shorten" },
    { label: "More formal", action: "formal" },
    { label: "Less formal", action: "casual" },
    { label: "Fix grammar", action: "grammar" },
    { label: "Simplify", action: "simplify" },
  ];

  const helperActions = [
    { label: "Generate", action: "generate", icon: Sparkles, description: "Create new text" },
    { label: "Make longer", action: "expand", icon: Wand2 },
    { label: "Make shorter", action: "shorten", icon: Wand2 },
    { label: "More formal", action: "formal", icon: Wand2 },
    { label: "Less formal", action: "casual", icon: Wand2 },
    { label: "Fix grammar", action: "grammar", icon: Wand2 },
    { label: "Simplify", action: "simplify", icon: Wand2 },
  ];

  return (
    <div className="relative space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium">Text Content</label>
        <Popover open={showHelperMenu} onOpenChange={setShowHelperMenu}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="h-7 gap-1.5 text-xs"
              disabled={isLoading}
            >
              {isLoading ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Sparkles className="h-3 w-3" />
              )}
              AI Helper
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-64 p-2" align="end">
            <div className="space-y-1">
              <div className="text-xs font-semibold text-muted-foreground px-2 py-1">
                AI Actions
              </div>
              {helperActions.map((action) => {
                const Icon = action.icon;
                return (
                  <Button
                    key={action.action}
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start text-sm"
                    onClick={() => handleHelperAction(action.action)}
                    disabled={isLoading}
                  >
                    <Icon className="h-3 w-3 mr-2" />
                    <div className="flex flex-col items-start">
                      <span>{action.label}</span>
                      {action.description && (
                        <span className="text-xs text-muted-foreground">
                          {action.description}
                        </span>
                      )}
                    </div>
                  </Button>
                );
              })}
            </div>
          </PopoverContent>
        </Popover>
      </div>

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
                  Transform selection
                </div>
                {selectionActions.map((action) => (
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
