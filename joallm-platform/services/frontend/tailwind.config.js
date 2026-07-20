/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class', // Enable dark mode with class strategy
  theme: {
    extend: {
      colors: {
        // Brand aliases → ATRISI institutional (kept as joa-* for existing classnames)
        'joa-primary': '#0f766e',
        'joa-secondary': '#0f172a',
        'joa-dark': '#1e293b',
        'joa-accent': '#3b82f6',
        'joa-bg': '#f1f5f9',
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
