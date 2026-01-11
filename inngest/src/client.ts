import { Inngest } from "inngest";

export const inngest = new Inngest({
  id: "authentik-email",
  name: "Authentik Email Service",
  // Use dev server in development mode
  isDev: process.env.NODE_ENV !== "production",
});
