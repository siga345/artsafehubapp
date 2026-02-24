import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"] ,
  theme: {
    extend: {
      colors: {
        "brand-ink": "#20322B",
        "brand-muted": "#6F7F73",
        "brand-surface": "#F7F9E3",
        "brand-border": "#C9D2BE",
        "brand-accent": "#2A342C"
      }
    }
  },
  plugins: []
};

export default config;
