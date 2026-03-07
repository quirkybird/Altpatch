import path from "node:path";
import { fileURLToPath } from "node:url";
import HtmlWebpackPlugin from "html-webpack-plugin";
import { altpatch } from "@quirkybird/webpack-plugin-altpatch";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default (_env, argv) => {
  const mode = argv.mode ?? "development";
  const isDev = mode === "development";

  return {
    mode,
    target: "web",
    devtool: isDev ? "eval-cheap-module-source-map" : "source-map",
    entry: path.resolve(__dirname, "src/main.tsx"),
    output: {
      path: path.resolve(__dirname, "dist"),
      filename: isDev ? "assets/[name].js" : "assets/[name].[contenthash:8].js",
      clean: true,
    },
    resolve: {
      extensions: [".tsx", ".ts", ".jsx", ".js"],
    },
    module: {
      rules: [
        {
          test: /\.[jt]sx?$/,
          exclude: /node_modules/,
          use: {
            loader: "babel-loader",
            options: {
              presets: [
                ["@babel/preset-react", { runtime: "automatic" }],
                "@babel/preset-typescript",
              ],
            },
          },
        },
      ],
    },
    plugins: [
      new HtmlWebpackPlugin({
        template: path.resolve(__dirname, "public/index.html"),
      }),
      altpatch({
        projectRoot: __dirname,
        apiPrefix: "/api",
        locator: {
          env: "development",
          dataAttribute: "path",
        },
        llm: {
          apiKey: process.env.ALTPATCH_LLM_API_KEY,
          baseUrl: process.env.ALTPATCH_LLM_BASE_URL,
          model: process.env.ALTPATCH_LLM_MODEL,
          timeoutMs: Number(process.env.ALTPATCH_LLM_TIMEOUT_MS ?? 60000),
          maxTokens: Number(process.env.ALTPATCH_LLM_MAX_TOKENS ?? 16384),
        },
      }),
    ],
    devServer: {
      host: "127.0.0.1",
      port: 5174,
      hot: true,
    },
  };
};
