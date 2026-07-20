/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class', // Enable dark mode with class strategy
  theme: {
    extend: {
      colors: {
        // JoaLLM Brand Colors
        'joa-primary': '#8B0000',
        'joa-secondary': '#000000',
        'joa-dark': '#1E293B',
        'joa-accent': '#3B82F6',
        'joa-bg': '#E8EDF2',
      },
    },
  },
  plugins: [],
};
