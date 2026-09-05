/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        surface: {
          DEFAULT: 'rgb(var(--hsk-surface) / <alpha-value>)',
          elevated: 'rgb(var(--hsk-surface-elevated) / <alpha-value>)',
          muted: 'rgb(var(--hsk-surface-muted) / <alpha-value>)',
        },
        foreground: {
          DEFAULT: 'rgb(var(--hsk-foreground) / <alpha-value>)',
          muted: 'rgb(var(--hsk-foreground-muted) / <alpha-value>)',
          inverted: 'rgb(var(--hsk-foreground-inverted) / <alpha-value>)',
        },
        edge: 'rgb(var(--hsk-edge) / <alpha-value>)',
        accent: {
          DEFAULT: 'rgb(var(--hsk-accent) / <alpha-value>)',
          foreground: 'rgb(var(--hsk-accent-foreground) / <alpha-value>)',
        },
        danger: {
          DEFAULT: 'rgb(var(--hsk-danger) / <alpha-value>)',
          foreground: 'rgb(var(--hsk-danger-foreground) / <alpha-value>)',
        },
        success: 'rgb(var(--hsk-success) / <alpha-value>)',
        warning: 'rgb(var(--hsk-warning) / <alpha-value>)',
        info: 'rgb(var(--hsk-info) / <alpha-value>)',
      },
      boxShadow: {
        panel: '0 18px 40px -18px rgb(15 23 42 / 0.35)',
      },
    },
  },
  plugins: [],
};
