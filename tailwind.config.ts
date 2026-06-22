import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        evolys: {
          DEFAULT: '#00286E', // bleu marine (principal)
          dark: '#001B4A',
          blue: '#6DCAFF',    // bleu clair
          light: '#DDF3FF',   // bleu très clair
          accent: '#FF9A41',  // orange (accent)
        },
      },
      fontFamily: {
        title: ['Quattrocento', 'Georgia', 'serif'],
        sans: ['"Quattrocento Sans"', 'Helvetica', 'Arial', 'sans-serif'],
      },
    },
  },
  plugins: [],
} satisfies Config;
