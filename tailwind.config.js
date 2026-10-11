export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        input: "hsl(var(--ui-input))",
        ring: "hsl(var(--ui-ring))",
        "muted-foreground": "hsl(var(--ui-muted-foreground))",
        primary: {
          DEFAULT: "hsl(var(--ui-primary))",
          foreground: "hsl(var(--ui-primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--ui-secondary))",
          foreground: "hsl(var(--ui-secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--ui-destructive))",
          foreground: "hsl(var(--ui-destructive-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--ui-popover))",
          foreground: "hsl(var(--ui-popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--ui-card))",
          foreground: "hsl(var(--ui-card-foreground))",
        },
        sidebar: {
          DEFAULT: "hsl(var(--ui-sidebar-background))",
          foreground: "hsl(var(--ui-sidebar-foreground))",
          primary: "hsl(var(--ui-sidebar-primary))",
          "primary-foreground": "hsl(var(--ui-sidebar-primary-foreground))",
          accent: "hsl(var(--ui-sidebar-accent))",
          "accent-foreground": "hsl(var(--ui-sidebar-accent-foreground))",
          border: "hsl(var(--ui-sidebar-border))",
          ring: "hsl(var(--ui-sidebar-ring))",
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)"],
        mono: ["var(--font-mono)"],
      },
    },
  },
};
