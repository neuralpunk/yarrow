/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        bg:       "var(--bg)",
        "bg-soft":"var(--bg-soft)",
        s1:       "var(--s1)",
        s2:       "var(--s2)",
        s3:       "var(--s3)",
        yel:      "var(--yel)",
        yel2:     "var(--yel2)",
        yelp:     "var(--yelp)",
        yeld:     "var(--yeld)",
        char:     "var(--char)",
        ch2:      "var(--ch2)",
        t2:       "var(--t2)",
        t3:       "var(--t3)",
        bd:       "var(--bd)",
        bd2:      "var(--bd2)",
        danger:   "var(--danger)",
        accent2:  "var(--accent2)",
        "accent2-dim": "var(--accent2-dim)",
        "on-yel": "var(--on-yel)",
        link:     "var(--link)",
      },
      fontFamily: {
        serif: ['"Source Serif 4"', 'ui-serif', 'Georgia', 'serif'],
        sans:  ['Merriweather', 'ui-serif', 'Georgia', 'serif'],
        mono:  ['"JetBrains Mono"', 'ui-monospace', 'Menlo', 'monospace'],
      },
      fontSize: {
        "2xs": ["12px", "16px"],
        xs:    ["13px", "18px"],
        sm:    ["14px", "20px"],
        base:  ["17px", "28px"],
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: 0 },
          "100%": { opacity: 1 },
        },
        slideUp: {
          "0%": { opacity: 0, transform: "translateY(8px)" },
          "100%": { opacity: 1, transform: "translateY(0)" },
        },
        forkSplit: {
          "0%": { transform: "scaleY(0)", opacity: 0 },
          "50%": { transform: "scaleY(1)", opacity: 1 },
          "100%": { transform: "scaleY(1)", opacity: 0.4 },
        },
        pulse2: {
          "0%, 100%": { opacity: 1 },
          "50%": { opacity: 0.4 },
        },
        slideInRight: {
          "0%": { opacity: 0, transform: "translateX(16px)" },
          "100%": { opacity: 1, transform: "translateX(0)" },
        },
      },
      animation: {
        fadeIn:       "fadeIn 200ms ease-out",
        slideUp:      "slideUp 220ms ease-out",
        forkSplit:    "forkSplit 900ms ease-out forwards",
        pulse2:       "pulse2 1.6s ease-in-out infinite",
        slideInRight: "slideInRight 180ms ease-out",
      },
    },
  },
  plugins: [],
};
