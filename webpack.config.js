const path = require("path");

module.exports = (env, argv) => {
  const isProd = argv.mode === "production";

  return {
    entry: "./src/index.tsx",
    output: {
      path: path.resolve(__dirname, "dist"),
      filename: "agent.js",
      library: { type: "umd", name: "ShopperGPT" },
      globalObject: "this",
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
          test: /\.(png|jpg|jpeg|gif|webp|svg)$/i,
          type: "asset/inline", // base64-inlines the image into the bundle — no separate file needed
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
