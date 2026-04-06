/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        canvas: {
          DEFAULT: "#030712",
          elevated: "#0a0f1a",
        },
        surface: {
          DEFAULT: "rgba(15, 23, 42, 0.72)",
          muted: "rgba(30, 41, 59, 0.55)",
          border: "rgba(148, 163, 184, 0.12)",
        },
        accent: {
          DEFAULT: "#22d3ee",
          muted: "rgba(34, 211, 238, 0.15)",
          foreground: "#020617",
        },
        content: {
          DEFAULT: "#f1f5f9",
          muted: "rgba(186, 198, 214, 0.92)",
          subtle: "rgba(148, 163, 184, 0.88)",
        },
        // Semantic status palette — use these instead of raw Tailwind color strings
        status: {
          // success / completed
          "done-border": "rgba(34, 197, 94, 0.35)",
          "done-bg": "rgba(34, 197, 94, 0.12)",
          "done-text": "#86efac",
          // warning / processing / queued
          "warn-border": "rgba(251, 191, 36, 0.35)",
          "warn-bg": "rgba(251, 191, 36, 0.12)",
          "warn-text": "#fde68a",
          // error / failed
          "fail-border": "rgba(239, 68, 68, 0.35)",
          "fail-bg": "rgba(239, 68, 68, 0.12)",
          "fail-text": "#fca5a5",
          // neutral / uploading / queued
          "neutral-border": "rgba(148, 163, 184, 0.25)",
          "neutral-bg": "rgba(30, 41, 59, 0.55)",
          "neutral-text": "#cbd5e1",
        },
        // Media type badges
        mediatype: {
          "video-border": "rgba(14, 165, 233, 0.35)",
          "video-bg": "rgba(14, 165, 233, 0.12)",
          "video-text": "#7dd3fc",
          "audio-border": "rgba(139, 92, 246, 0.35)",
          "audio-bg": "rgba(139, 92, 246, 0.12)",
          "audio-text": "#c4b5fd",
        },
      },
      fontFamily: {
        sans: ['"Space Grotesk"', "system-ui", "sans-serif"],
      },
      fontSize: {
        display: ["3rem", { lineHeight: "1.1", letterSpacing: "-0.02em", fontWeight: "700" }],
        h1: ["2.5rem", { lineHeight: "1.15", letterSpacing: "-0.02em", fontWeight: "700" }],
        h2: ["2rem", { lineHeight: "1.2", letterSpacing: "-0.02em", fontWeight: "700" }],
        h3: ["1.5rem", { lineHeight: "1.3", fontWeight: "600" }],
        body: ["1rem", { lineHeight: "1.6" }],
        small: ["0.875rem", { lineHeight: "1.5" }],
      },
      boxShadow: {
        glow: "0 0 24px -4px rgba(34, 211, 238, 0.45), 0 0 8px -2px rgba(34, 211, 238, 0.25)",
        "glow-sm": "0 0 16px -6px rgba(34, 211, 238, 0.4)",
        glass: "0 8px 32px rgba(0, 0, 0, 0.35)",
      },
      keyframes: {
        'fade-in': {
          '0%': { opacity: '0', transform: 'translateY(-8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-in-up': {
          '0%': { opacity: '0', transform: 'translateY(16px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'scale-in': {
          '0%': { opacity: '0', transform: 'scale(0.96)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        'shake': {
          '0%, 100%': { transform: 'translateX(0)' },
          '20%, 60%': { transform: 'translateX(-4px)' },
          '40%, 80%': { transform: 'translateX(4px)' },
        },
        'float': {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-6px)' },
        },
        'progress-pulse': {
          '0%, 100%': { opacity: '0.6' },
          '50%': { opacity: '1' },
        },
        'shimmer': {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        'slide-in-left': {
          '0%': { opacity: '0', transform: 'translateX(-100%)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        'slide-in-right': {
          '0%': { opacity: '0', transform: 'translateX(100%)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 0.5s ease-out forwards',
        'fade-in-up': 'fade-in-up 0.5s ease-out forwards',
        'scale-in': 'scale-in 0.35s ease-out forwards',
        'shake': 'shake 0.4s ease-in-out',
        'float': 'float 3s ease-in-out infinite',
        'progress-pulse': 'progress-pulse 1.5s ease-in-out infinite',
        'slide-in-left': 'slide-in-left 0.28s ease-out forwards',
        'slide-in-right': 'slide-in-right 0.28s ease-out forwards',
      },
    },
  },
  plugins: [],
}
