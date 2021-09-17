const pkg = require("./package.json");

/**
 * @type import('../../src/duckconfig').DuckConfig
 */
module.exports = {
  closureLibraryDir: "node_modules/google-closure-library",
  inputsRoot: "js",
  depsJs: "build/deps.js",
  depsJsIgnoreDirs: ["node_modules", "build"],
  entryConfigDir: "entry-config/entries",
  batch: "google",
  batchOptions: {
    region: "us-central1",
    googleCloudFunctionOptions: {
      runtime: "nodejs14",
    },
    include: ["js"],
    packageJson: {
      dependencies: {
        "google-closure-library": pkg.dependencies["google-closure-library"],
      },
    },
  },
  // http2: true,
  // https: {
  //   keyPath: "./duck-key.pem",
  //   certPath: "./duck-cert.pem",
  // },
};
