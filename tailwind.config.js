/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx}",
    "./components/**/*.{js,jsx}",
  ],
  theme: {
    extend: {
      colors: {
        beer: {
          light: "#f6c453",
          DEFAULT: "#d69e2e",
          dark: "#975a16",
        },
      },
    },
  },
  plugins: [],
};
