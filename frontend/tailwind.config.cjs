/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{html,js,svelte,ts}'],
  theme: {
    extend: {
      colors: {
        bg: 'hsl(var(--bg))',
        surface: 'hsl(var(--surface))',
        text: 'hsl(var(--text))',
        primary: 'hsl(var(--primary))',
        accent: 'hsl(var(--accent))',
        border: 'hsl(var(--border))'
      }
    }
  },
  plugins: []
};
