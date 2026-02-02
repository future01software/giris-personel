// craco.config.js
const path = require("path");
require("dotenv").config();

// CRA: start => development, build => production
const isDevServer = process.env.NODE_ENV !== "production";

const config = {
  enableHealthCheck: process.env.ENABLE_HEALTH_CHECK === "true",
  enableVisualEdits: isDevServer,
};

let setupDevServer;
let babelMetadataPlugin;

if (config.enableVisualEdits) {
  setupDevServer = require("./plugins/visual-edits/dev-server-setup");
  babelMetadataPlugin = require("./plugins/visual-edits/babel-metadata-plugin");
}

let WebpackHealthPlugin;
let setupHealthEndpoints;
let healthPluginInstance;

if (config.enableHealthCheck) {
  WebpackHealthPlugin = require("./plugins/health-check/webpack-health-plugin");
  setupHealthEndpoints = require("./plugins/health-check/health-endpoints");
  healthPluginInstance = new WebpackHealthPlugin();
}

const cracoConfig = {
  eslint: {
    configure: {
      extends: ["plugin:react-hooks/recommended"],
      rules: {
        "react-hooks/rules-of-hooks": "error",
        "react-hooks/exhaustive-deps": "warn",
      },
    },
  },

  webpack: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
    configure: (webpackConfig) => {
      webpackConfig.watchOptions = {
        ...webpackConfig.watchOptions,
        ignored: [
          "**/node_modules/**",
          "**/.git/**",
          "**/build/**",
          "**/dist/**",
          "**/coverage/**",
          "**/public/**",
        ],
      };

      // Production optimizations
      if (process.env.NODE_ENV === "production") {
        // Code splitting optimization
        webpackConfig.optimization = {
          ...webpackConfig.optimization,
          splitChunks: {
            chunks: "all",
            cacheGroups: {
              vendor: {
                test: /[\\/]node_modules[\\/]/,
                name: "vendors",
                priority: 10,
                reuseExistingChunk: true,
              },
              common: {
                minChunks: 2,
                priority: 5,
                reuseExistingChunk: true,
              },
              radix: {
                test: /[\\/]node_modules[\\/]@radix-ui[\\/]/,
                name: "radix",
                priority: 20,
              },
            },
          },
          runtimeChunk: "single",
        };

        // Performance hints
        webpackConfig.performance = {
          ...webpackConfig.performance,
          maxEntrypointSize: 1024000,
          maxAssetSize: 1024000,
          hints: isDevServer ? false : "warning",
        };
      }

      if (config.enableHealthCheck && healthPluginInstance) {
        webpackConfig.plugins.push(healthPluginInstance);
      }

      return webpackConfig;
    },
  },

  devServer: (devServerConfig) => {
    if (config.enableVisualEdits && setupDevServer) {
      devServerConfig = setupDevServer(devServerConfig);
    }

    if (config.enableHealthCheck && setupHealthEndpoints && healthPluginInstance) {
      const originalSetupMiddlewares = devServerConfig.setupMiddlewares;

      devServerConfig.setupMiddlewares = (middlewares, devServer) => {
        if (originalSetupMiddlewares) {
          middlewares = originalSetupMiddlewares(middlewares, devServer);
        }

        setupHealthEndpoints(devServer, healthPluginInstance);
        return middlewares;
      };
    }

    return devServerConfig;
  },
};

if (config.enableVisualEdits && babelMetadataPlugin) {
  cracoConfig.babel = {
    plugins: [babelMetadataPlugin],
  };
}

module.exports = cracoConfig;
