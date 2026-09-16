/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx,html}",
  ],
  theme: {
    extend: {
      colors: {
        'coffee-dark': '#0a0908',
        'coffee-surface': '#121110',
        'coffee-gold': '#d4af37',
        'coffee-gold-light': '#f3e5ab',
        'coffee-gold-dark': '#aa820a',
        'coffee-cream': '#f4efe6',
        'coffee-muted': '#8e8a85',
      },
      fontFamily: {
        serif: ['Cinzel Decorative', 'Playfair Display', 'Georgia', 'serif'],
        sans: ['Plus Jakarta Sans', 'Inter', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
