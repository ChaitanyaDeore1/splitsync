/** @type {import('tailwindcss').Config} */
export default {
  // Tailwind only generates CSS for class names it finds in these files
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial', 'sans-serif'],
      },
      colors: {
        navy: { 700: '#1b2559', 800: '#131c45', 900: '#0b1437' }, // sidebar
        brand: { 50: '#f5f3ff', 100: '#ede9fe', 200: '#ddd6fe', 500: '#8b5cf6', 600: '#7c3aed', 700: '#6d28d9' }, // purple actions
        owed: '#16a34a', // green: money you will receive
        owe: '#dc2626', // red: money you have to pay
      },
      boxShadow: {
        card: '0 1px 2px rgba(15, 23, 42, 0.04), 0 1px 3px rgba(15, 23, 42, 0.06)',
        pop: '0 10px 30px -6px rgba(15, 23, 42, 0.25)',
      },
      keyframes: {
        'slide-in': { from: { opacity: '0', transform: 'translateY(8px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
        'grow-up': { from: { transform: 'scaleY(0)' }, to: { transform: 'scaleY(1)' } },
      },
      animation: { 'slide-in': 'slide-in .2s ease-out', 'grow-up': 'grow-up .5s ease-out both' },
    },
  },
  plugins: [],
};
