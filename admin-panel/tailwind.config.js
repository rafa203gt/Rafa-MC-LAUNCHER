/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'admin-dark': '#0a0d14',
        'admin-card': '#111622',
        'admin-border': '#1e2638',
      }
    },
  },
  plugins: [],
}
