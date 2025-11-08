import { useState, useEffect } from "react";
import { Puck, Render } from "@measured/puck";
import "@measured/puck/puck.css";
import config, { initialData } from "@/config/puck";
import { UserData } from "@/config/puck/types";

export default function NewsletterCreatePage() {
  const [data, setData] = useState<UserData>(initialData);
  const [isClient, setIsClient] = useState(false);
  const [isEdit, setIsEdit] = useState(true);

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

  if (isEdit) {
    return (
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
