import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"] ,
  theme: {
    extend: {
      colors: {
        "brand-ink": "#0F172A",
        "brand-muted": "#94A3B8",
        "brand-surface": "#F8FAFC",
        "brand-border": "#E2E8F0",
        "brand-accent": "#6366F1"
      }
    }
  },
  plugins: []
};

export default config;
