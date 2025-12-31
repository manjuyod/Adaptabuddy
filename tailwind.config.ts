import type { Config } from "tailwindcss";
import { fontFamily } from "tailwindcss/defaultTheme";
import animate from "tailwindcss-animate";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#e4f3ff",
          100: "#c6dfff",
          200: "#9ac4ff",
          300: "#67a2ff",
          400: "#3e7efe",
          500: "#205cf0",
          600: "#1647c8",
          700: "#1239a0",
          800: "#123280",
          900: "#102a68"
        }
      },
      fontFamily: {
        sans: ["\"Space Grotesk\"", ...fontFamily.sans]
      },
      boxShadow: {
        card: "0 8px 30px rgba(15, 23, 42, 0.12)"
      }
    }
  },
  plugins: [animate]
};

export default config;
