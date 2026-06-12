import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        mesa: {
          950: "#07130f",
          900: "#0f241b",
          800: "#193528",
          700: "#244636",
        },
        carta: {
          paper: "#fffaf0",
          ink: "#251911",
          red: "#a32525",
          gold: "#b7791f",
        },
      },
      boxShadow: {
        card: "0 10px 24px rgba(8, 16, 12, 0.22)",
      },
      fontFamily: {
        display: ["Georgia", "serif"],
      },
    },
  },
  plugins: [],
} satisfies Config;
