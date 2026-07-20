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
        // ATRISI institutional palette (mirrors App.css --atrisi-*)
        atrisi: {
          navy: '#0f172a',
          'navy-light': '#1e293b',
          'navy-dark': '#020617',
          blue: '#1e40af',
          'blue-light': '#3b82f6',
          'blue-accent': '#0f766e',
          slate: '#475569',
          'slate-light': '#64748b',
          'slate-dark': '#334155',
          gray: '#f1f5f9',
          'gray-dark': '#e2e8f0',
          white: '#ffffff',
        },
      },
      backgroundImage: {
        'atrisi-primary': 'linear-gradient(135deg, #0f172a 0%, #1e40af 100%)',
        'atrisi-hero': 'linear-gradient(135deg, #020617 0%, #0f172a 50%, #1e40af 100%)',
        'atrisi-card': 'linear-gradient(135deg, #ffffff 0%, #f1f5f9 100%)',
      },
    },
  },
  plugins: [],
};
