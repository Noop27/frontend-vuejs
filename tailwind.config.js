/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    // This line tells Tailwind to look inside all .vue files inside src
    "./src/**/*.{vue,js,ts,jsx,tsx}", 
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}