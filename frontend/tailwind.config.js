/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
    '../modules/problem/frontend/**/*.{js,ts,jsx,tsx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: [
          'Inter',
          'ui-sans-serif',
          'system-ui',
          'Segoe UI',
          'Helvetica Neue',
          'Arial',
          'sans-serif',
        ],
      },
      fontSize: {
        display: ['32px', { lineHeight: '1.15', letterSpacing: '-0.03em', fontWeight: '600' }],
        title: ['20px', { lineHeight: '1.3', letterSpacing: '-0.02em', fontWeight: '600' }],
        body: ['14px', { lineHeight: '1.55' }],
        caption: ['12px', { lineHeight: '1.45' }],
      },
      colors: {
        canvas: 'rgb(var(--hsk-canvas) / <alpha-value>)',
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
        panel: '0 16px 40px -24px rgb(17 19 24 / 0.28)',
        float: '0 8px 24px -16px rgb(17 19 24 / 0.35)',
      },
      borderRadius: {
        control: '10px',
        panel: '14px',
      },
      transitionDuration: {
        df: '180ms',
      },
    },
  },
  plugins: [],
};
