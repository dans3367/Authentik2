import { UserData } from "./types";

export const initialData: UserData = {
  content: [
    {
      type: "Hero",
      props: {
        title: "Build Your Newsletter with Puck",
        description:
          "Puck is the self-hosted visual editor for React. Bring your own components and make site changes instantly, without a deploy.",
        buttons: [
          {
            label: "Get Started",
            href: "#",
          },
          { label: "Learn More", href: "#", variant: "secondary" },
        ],
        id: "Hero-1687283596554",
        image: {
          url: "https://images.unsplash.com/photo-1557804506-669a67965ba0",
          mode: "inline",
        },
        padding: "128px",
        align: "left",
      },
    },
    {
      type: "Space",
      props: {
        size: "96px",
        id: "Space-1687298109536",
        direction: "vertical",
      },
    },
    {
      type: "Heading",
      props: {
        align: "center",
        level: "2",
        text: "Drag-and-drop your own React components",
        layout: { padding: "0px" },
        size: "xxl",
        id: "Heading-1687297593514",
      },
    },
    {
      type: "Space",
      props: {
        size: "8px",
        id: "Space-1687284122744",
        direction: "vertical",
      },
    },
    {
      type: "Text",
      props: {
        align: "center",
        text: "Configure Puck with your own components to make changes for your marketing pages without a developer.",
        layout: { padding: "0px" },
        size: "m",
        id: "Text-1687297621556",
        color: "muted",
      },
    },
    {
      type: "Space",
      props: {
        size: "40px",
        id: "Space-1687296179388",
        direction: "vertical",
      },
    },
    {
      type: "Grid",
      props: {
        id: "Grid-c4cd99ae-8c5e-4cdb-87d2-35a639f5163e",
        gap: 24,
        numColumns: 3,
        items: [
          {
            type: "Card",
            props: {
              title: "Built for content teams",
              description:
                "Puck enables content teams to make changes to their content without a developer or breaking the UI.",
              icon: "PenTool",
              mode: "flat",
              layout: { grow: true, spanCol: 1, spanRow: 1, padding: "0px" },
              id: "Card-66ab42c9-d1da-4c44-9dba-5d7d72f2178d",
            },
          },
          {
            type: "Card",
            props: {
              title: "Easy to integrate",
              description:
                "Front-end developers can easily integrate their own components using a familiar React API.",
              icon: "GitMerge",
              mode: "flat",
              layout: { grow: true, spanCol: 1, spanRow: 1, padding: "0px" },
              id: "Card-0012a293-8ef3-4e7c-9d7c-7da0a03d97ae",
            },
          },
          {
            type: "Card",
            props: {
              title: "No vendor lock-in",
              description:
                "Completely open-source, Puck is designed to be integrated into your existing React application.",
              icon: "Github",
              mode: "flat",
              layout: { grow: true, spanCol: 1, spanRow: 1, padding: "0px" },
              id: "Card-09efb3f3-f58d-4e07-a481-7238d7e57ad6",
            },
          },
        ],
      },
    },
    {
      type: "Space",
      props: {
        size: "96px",
        id: "Space-1687287070296",
        direction: "vertical",
      },
    },
  ],
  root: { props: { title: "Newsletter Editor" } },
  zones: {},
};
