const path = require("path");

module.exports = (env, argv) => {
  const isProd = argv.mode === "production";

  return {
    entry: "./src/index.tsx",
    output: {
      path: path.resolve(__dirname, "dist"),
      filename: "agent.js",
      // Plain global build (IIFE), NOT UMD. A UMD wrapper checks `define.amd`
      // first and, on any host page that ships an AMD loader (RequireJS — which
      // Magento's frontend is built on), takes the AMD branch: it registers
      // itself via `define([], factory)` instead of running. The factory that
      // bootstraps and mounts the widget then never executes, so nothing renders
      // (no shadow root, no panel, no button) — while the file still downloads
      // fine, which is why it "loads but nothing appears" only on AMD hosts and
      // works on the plain-HTML sandbox. `type: "window"` just runs the entry and
      // exposes `window.ShopperGPT` (also a handy "did the bundle boot?" marker).
      // Do NOT revert to "umd" without re-checking every embedding host for AMD.
      library: { type: "window", name: "ShopperGPT" },
      clean: true,
    },
    resolve: {
      extensions: [".ts", ".tsx", ".js", ".jsx"],
      alias: {
        react: "preact/compat",
        "react-dom": "preact/compat",
        "react/jsx-runtime": "preact/jsx-runtime",
        "react-dom/test-utils": "preact/test-utils",
      },
    },
    module: {
      rules: [
        {
          test: /\.tsx?$/,
          use: "ts-loader",
          exclude: /node_modules/,
        },
        {
          // `import x from './icon.svg?raw'` — raw markup string, used for step icons so
          // their fill can be forced to currentColor via CSS (theming, active/inactive tabs).
          test: /\.svg$/i,
          resourceQuery: /raw/,
          type: "asset/source",
        },
        {
          test: /\.(png|jpg|jpeg|gif|webp|svg)$/i,
          resourceQuery: { not: [/raw/] },
          type: "asset/inline", // base64-inlines the image into the bundle — no separate file needed
        },
        {
          test: /\.(woff2?|ttf|otf|eot)$/i,
          type: "asset/inline", // inline local fonts so the widget is self-contained
        },
        {
          // Export CSS as a plain string so we can inject it into the Shadow DOM
          test: /\.css$/,
          use: [
            { loader: "css-loader", options: { exportType: "string" } },
            {
              loader: "postcss-loader",
              options: {
                postcssOptions: {
                  plugins: [
                    require("tailwindcss")({ config: "./tailwind.config.js" }),
                    require("autoprefixer"),
                  ],
                },
              },
            },
          ],
        },
      ],
    },
    optimization: {
      minimize: isProd,
    },
    performance: {
      hints: false,
    },
    devtool: isProd ? false : "inline-source-map",
  };
};
