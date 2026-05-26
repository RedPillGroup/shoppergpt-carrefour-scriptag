/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        carrefour: {
          blue: "#004E9A",
          red: "#E4002B",
          lightBlue: "#0070CC",
          bg: "#F5F7FA",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
