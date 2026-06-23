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
      keyframes: {
        // Light band sweeping across clipped text — the "thinking…" shimmer.
        shimmer: {
          "0%": { backgroundPosition: "200% 0" },
          "100%": { backgroundPosition: "-200% 0" },
        },
      },
      animation: {
        shimmer: "shimmer 2.4s linear infinite",
      },
    },
  },
  plugins: [],
};
