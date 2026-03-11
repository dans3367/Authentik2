import { useState } from "react";
import { createUsePuck } from "@puckeditor/core";
import { generateNewsletterText } from "@/lib/aiApi";
import { Sparkles, Loader2, ChevronDown, RotateCcw, Check } from "lucide-react";

const toneOptions = [
  { label: "Professional", value: "professional" },
  { label: "Formal", value: "formal" },
  { label: "Casual", value: "casual" },
  { label: "Persuasive", value: "persuasive" },
] as const;

type Tone = (typeof toneOptions)[number]["value"];

const usePuck = createUsePuck();

export function AiTextCreator() {
  const [prompt, setPrompt] = useState("");
  const [tone, setTone] = useState<Tone>("professional");
  const [generatedText, setGeneratedText] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState("");
  const [inserted, setInserted] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  const selectedItem = usePuck((s) => s.selectedItem);
  const dispatch = usePuck((s) => s.dispatch);

  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    setIsGenerating(true);
    setError("");
    setGeneratedText("");
    setInserted(false);

    try {
      const result = await generateNewsletterText({ prompt: prompt.trim(), tone });
      if (result.success && result.text) {
        setGeneratedText(result.text);
      } else {
        setError(result.error || "Failed to generate text");
      }
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleInsert = () => {
    if (!generatedText || !selectedItem) return;

    const targetId = selectedItem.props.id;
    const updateItem = (item: any) =>
      item.props.id === targetId
        ? { ...item, props: { ...item.props, text: generatedText } }
        : item;

    dispatch({
      type: "setData",
      data: (prev: any) => {
        const updated: any = {
          ...prev,
          content: prev.content.map(updateItem),
        };
        if (prev.zones) {
          updated.zones = Object.fromEntries(
            Object.entries(prev.zones).map(([zone, items]: [string, any]) => [
              zone,
              Array.isArray(items) ? items.map(updateItem) : items,
            ])
          );
        }
        return updated;
      },
    });

    setInserted(true);
    setTimeout(() => setInserted(false), 2000);
  };

  const handleRegenerate = () => {
    setInserted(false);
    handleGenerate();
  };

  return (
    <div style={{ marginTop: "4px" }}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          gap: "8px",
          padding: "10px 12px",
          background: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)",
          color: "#fff",
          border: "none",
          borderRadius: "8px",
          cursor: "pointer",
          fontSize: "13px",
          fontWeight: 600,
          transition: "all 0.2s",
        }}
      >
        <Sparkles size={15} />
        <span style={{ flex: 1, textAlign: "left" }}>AI Creator</span>
        <ChevronDown
          size={14}
          style={{
            transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
            transition: "transform 0.2s",
          }}
        />
      </button>

      {isOpen && (
        <div
          style={{
            marginTop: "8px",
            padding: "12px",
            background: "#f8fafc",
            border: "1px solid #e2e8f0",
            borderRadius: "8px",
          }}
        >
          <label
            style={{
              display: "block",
              fontSize: "12px",
              fontWeight: 600,
              color: "#475569",
              marginBottom: "6px",
            }}
          >
            What should this text be about?
          </label>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="e.g. A weekly tech newsletter covering AI news, product launches, and developer tips..."
            rows={3}
            style={{
              width: "100%",
              padding: "8px 10px",
              fontSize: "13px",
              border: "1px solid #d1d5db",
              borderRadius: "6px",
              resize: "vertical",
              outline: "none",
              fontFamily: "inherit",
              lineHeight: "1.5",
              boxSizing: "border-box",
            }}
            onFocus={(e) => (e.target.style.borderColor = "#818cf8")}
            onBlur={(e) => (e.target.style.borderColor = "#d1d5db")}
          />

          <div style={{ marginTop: "8px", display: "flex", gap: "8px", alignItems: "center" }}>
            <label
              style={{
                fontSize: "12px",
                fontWeight: 600,
                color: "#475569",
                whiteSpace: "nowrap",
              }}
            >
              Tone:
            </label>
            <select
              value={tone}
              onChange={(e) => setTone(e.target.value as Tone)}
              style={{
                flex: 1,
                padding: "5px 8px",
                fontSize: "12px",
                border: "1px solid #d1d5db",
                borderRadius: "6px",
                background: "#fff",
                outline: "none",
                cursor: "pointer",
              }}
            >
              {toneOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={handleGenerate}
            disabled={isGenerating || !prompt.trim()}
            style={{
              width: "100%",
              marginTop: "10px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "6px",
              padding: "8px 12px",
              background:
                isGenerating || !prompt.trim()
                  ? "#c7d2fe"
                  : "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)",
              color: "#fff",
              border: "none",
              borderRadius: "6px",
              cursor: isGenerating || !prompt.trim() ? "not-allowed" : "pointer",
              fontSize: "13px",
              fontWeight: 600,
              transition: "all 0.2s",
            }}
          >
            {isGenerating ? (
              <>
                <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} />
                Generating...
              </>
            ) : (
              <>
                <Sparkles size={14} />
                Generate
              </>
            )}
          </button>

          {error && (
            <div
              style={{
                marginTop: "8px",
                padding: "8px 10px",
                background: "#fef2f2",
                border: "1px solid #fecaca",
                borderRadius: "6px",
                fontSize: "12px",
                color: "#dc2626",
              }}
            >
              {error}
            </div>
          )}

          {generatedText && (
            <div style={{ marginTop: "10px" }}>
              <label
                style={{
                  display: "block",
                  fontSize: "12px",
                  fontWeight: 600,
                  color: "#475569",
                  marginBottom: "6px",
                }}
              >
                Generated Newsletter
              </label>
              <div
                className="ai-newsletter-preview"
                style={{
                  padding: "10px",
                  background: "#fff",
                  border: "1px solid #d1d5db",
                  borderRadius: "6px",
                  fontSize: "13px",
                  lineHeight: "1.6",
                  color: "#1e293b",
                  maxHeight: "250px",
                  overflowY: "auto",
                }}
                dangerouslySetInnerHTML={{ __html: generatedText }}
              />

              <div style={{ display: "flex", gap: "6px", marginTop: "8px" }}>
                <button
                  type="button"
                  onClick={handleInsert}
                  disabled={inserted}
                  style={{
                    flex: 1,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "6px",
                    padding: "8px 12px",
                    background: inserted
                      ? "#22c55e"
                      : "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)",
                    color: "#fff",
                    border: "none",
                    borderRadius: "6px",
                    cursor: inserted ? "default" : "pointer",
                    fontSize: "13px",
                    fontWeight: 600,
                    transition: "all 0.2s",
                  }}
                >
                  {inserted ? (
                    <>
                      <Check size={14} />
                      Inserted!
                    </>
                  ) : (
                    "Insert"
                  )}
                </button>
                <button
                  type="button"
                  onClick={handleRegenerate}
                  disabled={isGenerating}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "4px",
                    padding: "8px 12px",
                    background: "#fff",
                    color: "#6366f1",
                    border: "1px solid #c7d2fe",
                    borderRadius: "6px",
                    cursor: isGenerating ? "not-allowed" : "pointer",
                    fontSize: "13px",
                    fontWeight: 600,
                    transition: "all 0.2s",
                  }}
                >
                  <RotateCcw size={13} />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .ai-newsletter-preview h2 { font-size: 16px; font-weight: 700; margin: 0 0 8px 0; color: #0f172a; }
        .ai-newsletter-preview h3 { font-size: 14px; font-weight: 600; margin: 12px 0 6px 0; color: #1e293b; }
        .ai-newsletter-preview p { margin: 0 0 8px 0; }
        .ai-newsletter-preview ul, .ai-newsletter-preview ol { margin: 0 0 8px 0; padding-left: 18px; }
        .ai-newsletter-preview li { margin-bottom: 3px; }
        .ai-newsletter-preview hr { border: none; border-top: 1px solid #e2e8f0; margin: 10px 0; }
        .ai-newsletter-preview strong { font-weight: 600; }
      `}</style>
    </div>
  );
}
