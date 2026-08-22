/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'obs': {
          'base': '#050709',
          'surface': '#0a0e16',
          'card': '#0f1420',
          'elevated': '#151c2c',
          'border': '#1a2236',
          'border-light': '#243052',
          'muted': '#8892a8',
        },
        'admin-dark': '#0a0d14',
        'admin-card': '#111622',
        'admin-border': '#1e2638',
      },
      animation: {
        'glow-pulse': 'glow-pulse 3s ease-in-out infinite',
        'shimmer': 'shimmer 2s linear infinite',
        'float': 'float 6s ease-in-out infinite',
        'slide-in': 'slide-in 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'fade-up': 'fade-up 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards',
      },
      keyframes: {
        'glow-pulse': {
          '0%, 100%': { opacity: '0.4' },
          '50%': { opacity: '0.8' },
        },
        'shimmer': {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(100%)' },
        },
        'float': {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-8px)' },
        },
        'slide-in': {
          '0%': { opacity: '0', transform: 'translateX(-12px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      backgroundImage: {
        'mesh-gradient': 'radial-gradient(at 20% 30%, rgba(99,102,241,0.08) 0, transparent 50%), radial-gradient(at 80% 60%, rgba(139,92,246,0.06) 0, transparent 50%), radial-gradient(at 50% 90%, rgba(14,165,233,0.05) 0, transparent 50%)',
      },
    },
  },
  plugins: [],
}
