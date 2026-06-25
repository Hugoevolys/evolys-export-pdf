import type { Config } from 'tailwindcss';

// Charte Evolys (couleurs officielles + polices Quattrocento)
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        navy: { DEFAULT: '#00286E', dark: '#001B4A', light: '#DDF3FF' },
        brand: { blue: '#6DCAFF', light: '#DDF3FF', green: '#2E8B57', teal: '#1E8E7E', accent: '#FF9A41' },
      },
      fontFamily: {
        title: ['Quattrocento', 'Georgia', 'serif'],
        sans: ['"Quattrocento Sans"', 'Helvetica', 'Arial', 'sans-serif'],
      },
    },
  },
  plugins: [],
} satisfies Config;
