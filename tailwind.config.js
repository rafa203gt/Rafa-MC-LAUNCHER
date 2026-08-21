/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        mc: {
          dark: '#0f1117',
          darker: '#090a0f',
          card: '#161922',
          cardHover: '#1d222e',
          border: '#242938',
          accent: '#10b981',
          accentHover: '#059669',
          accentGlow: 'rgba(16, 185, 129, 0.25)',
          danger: '#ef4444',
          warning: '#f59e0b',
          textMuted: '#94a3b8'
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      boxShadow: {
        'glow': '0 0 25px rgba(16, 185, 129, 0.3)',
        'glow-lg': '0 0 40px rgba(16, 185, 129, 0.45)',
      }
    },
  },
  plugins: [],
}
