module.exports = {
  plugins: {
    "@tailwindcss/postcss": {},
    // Tailwind's custom properties leak through shadow DOM boundaries (custom properties
    // inherit by design), so rename them to avoid colliding with the host page's Tailwind.
    "./src/utils/styles/postcss-rename-custom-props.cjs": {
      fromPrefix: "--tw-",
      toPrefix: "--ng-tw-",
    },
    // `rem` units keep scaling with the host page's root font-size inside shadow DOM,
    // so convert them to px to keep the bubble the same size everywhere.
    "postcss-rem-to-responsive-pixel": {
      rootValue: 16,
      propList: ["*"],
      transformUnit: "px",
    },
  },
}