/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        bg: {
          DEFAULT: "#0a0d16",
          subtle: "#0e1220",
          card: "#131828",
          hover: "#181d30",
        },
        border: {
          DEFAULT: "#222a3f",
          strong: "#2d364f",
        },
        ink: {
          DEFAULT: "#e6eaf2",
          muted: "#8b94ad",
          subtle: "#5a6378",
        },
        brand: {
          DEFAULT: "#7c5cff",
          dim: "#5b46c4",
          glow: "#9d83ff",
        },
        bull: {
          DEFAULT: "#22c55e",
          dim: "#16a34a",
          bg: "rgba(34, 197, 94, 0.10)",
        },
        bear: {
          DEFAULT: "#ef4444",
          dim: "#dc2626",
          bg: "rgba(239, 68, 68, 0.10)",
        },
        warn: {
          DEFAULT: "#f59e0b",
          bg: "rgba(245, 158, 11, 0.10)",
        },
      },
      fontFamily: {
        sans: [
          "Inter",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Roboto",
          "sans-serif",
        ],
        mono: [
          "JetBrains Mono",
          "ui-monospace",
          "SFMono-Regular",
          "Menlo",
          "monospace",
        ],
      },
      fontSize: {
        "2xs": "0.6875rem",
      },
      boxShadow: {
        glow: "0 0 0 1px rgba(124, 92, 255, 0.30), 0 8px 32px -8px rgba(124, 92, 255, 0.40)",
        card: "0 1px 0 0 rgba(255,255,255,0.03) inset, 0 0 0 1px rgba(255,255,255,0.02)",
      },
      backgroundImage: {
        "grid-faint":
          "linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px)",
        "brand-gradient":
          "linear-gradient(135deg, #7c5cff 0%, #4f7dff 50%, #22d3ee 100%)",
      },
      animation: {
        "pulse-slow": "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "fade-in": "fadeIn 0.3s ease-out",
        shimmer: "shimmer 2.4s linear infinite",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0", transform: "translateY(4px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
      },
    },
  },
  plugins: [],
};
