/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brick: { DEFAULT: '#B7412E', dark: '#8E2F20', tint: '#FBE7E2' },
        navy: { DEFAULT: '#14213D', soft: '#34436A' },
        paper: { DEFAULT: '#F6F3EC', deep: '#EBE5D7' },
        line: '#E4DFD3',
        muted: '#5A6072',
        gold: '#F2C14E',
      },
      fontFamily: {
        display: ['"Bricolage Grotesque"', 'system-ui', 'sans-serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
