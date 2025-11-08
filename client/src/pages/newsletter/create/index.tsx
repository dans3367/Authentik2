import { useState, useEffect } from "react";
import { Puck, Render } from "@measured/puck";
import "@measured/puck/puck.css";
import config, { initialData } from "@/config/puck";
import { UserData } from "@/config/puck/types";
import { Monitor, Tablet, Smartphone } from "lucide-react";

export default function NewsletterCreatePage() {
  const [data, setData] = useState<UserData>(initialData);
  const [isClient, setIsClient] = useState(false);
  const [isEdit, setIsEdit] = useState(true);
  const [viewport, setViewport] = useState<"mobile" | "tablet" | "desktop">("desktop");

  useEffect(() => {
    setIsClient(true);
    
    // Try to load saved data from localStorage
    const savedData = localStorage.getItem("newsletter-puck-data");
    if (savedData) {
      try {
        setData(JSON.parse(savedData));
      } catch (e) {
        console.error("Failed to parse saved data", e);
      }
    }
  }, []);

  const handlePublish = async (data: UserData) => {
    // Save to localStorage
    localStorage.setItem("newsletter-puck-data", JSON.stringify(data));
    setData(data);
    setIsEdit(false);
    alert("Newsletter published successfully!");
  };

  if (!isClient) {
    return null;
  }

  const viewportWidths = {
    mobile: "360px",
    tablet: "768px",
    desktop: "100%",
  };

  const getViewportStyles = () => {
    if (viewport === "desktop") {
      return `
        .Puck-frame {
          max-width: 100% !important;
          margin: 0 auto !important;
        }
      `;
    }
    return `
      .Puck-frame {
        max-width: ${viewportWidths[viewport]} !important;
        margin: 0 auto !important;
        box-shadow: 0 0 0 1px rgba(0,0,0,0.1), 0 4px 12px rgba(0,0,0,0.1) !important;
      }
    `;
  };

  if (isEdit) {
    return (
      <>
        <style>{getViewportStyles()}</style>
        <div style={{ height: "100vh", display: "flex", flexDirection: "column" }}>
          <Puck
            config={config}
            data={data}
            onPublish={handlePublish}
            headerPath="/newsletter/create"
            iframe={{
              enabled: false,
            }}
            overrides={{
              headerActions: ({ children }: { children: React.ReactNode }) => (
                <>
                  <div style={{ display: "flex", gap: "4px", marginRight: "8px" }}>
                    <button
                      onClick={() => setViewport("mobile")}
                      style={{
                        padding: "8px",
                        background: viewport === "mobile" ? "#2563eb" : "#fff",
                        color: viewport === "mobile" ? "#fff" : "#000",
                        border: "1px solid #e5e7eb",
                        borderRadius: "4px",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: "4px",
                      }}
                      title="Mobile view"
                      data-testid="viewport-mobile"
                    >
                      <Smartphone size={16} />
                      <span style={{ fontSize: "12px" }}>360px</span>
                    </button>
                    <button
                      onClick={() => setViewport("tablet")}
                      style={{
                        padding: "8px",
                        background: viewport === "tablet" ? "#2563eb" : "#fff",
                        color: viewport === "tablet" ? "#fff" : "#000",
                        border: "1px solid #e5e7eb",
                        borderRadius: "4px",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: "4px",
                      }}
                      title="Tablet view"
                      data-testid="viewport-tablet"
                    >
                      <Tablet size={16} />
                      <span style={{ fontSize: "12px" }}>768px</span>
                    </button>
                    <button
                      onClick={() => setViewport("desktop")}
                      style={{
                        padding: "8px",
                        background: viewport === "desktop" ? "#2563eb" : "#fff",
                        color: viewport === "desktop" ? "#fff" : "#000",
                        border: "1px solid #e5e7eb",
                        borderRadius: "4px",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: "4px",
                      }}
                      title="Desktop view"
                      data-testid="viewport-desktop"
                    >
                      <Monitor size={16} />
                      <span style={{ fontSize: "12px" }}>Full</span>
                    </button>
                  </div>
                  <button
                    onClick={() => setIsEdit(false)}
                    style={{
                      padding: "8px 16px",
                      marginRight: "8px",
                      background: "#fff",
                      border: "1px solid #e5e7eb",
                      borderRadius: "4px",
                      cursor: "pointer",
                    }}
                    data-testid="button-preview"
                  >
                    Preview
                  </button>
                  {children}
                </>
              ),
            }}
          />
        </div>
      </>
    );
  }

  return (
    <div>
      <div
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          background: "white",
          borderBottom: "1px solid #e5e7eb",
          padding: "16px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          zIndex: 1000,
        }}
      >
        <h1 style={{ margin: 0, fontSize: "18px", fontWeight: 600 }}>
          Newsletter Preview
        </h1>
        <button
          onClick={() => setIsEdit(true)}
          style={{
            padding: "8px 16px",
            background: "#2563eb",
            color: "white",
            border: "none",
            borderRadius: "4px",
            cursor: "pointer",
          }}
          data-testid="button-edit"
        >
          Back to Editor
        </button>
      </div>
      <div style={{ paddingTop: "64px" }}>
        <Render config={config} data={data} />
      </div>
    </div>
  );
}
