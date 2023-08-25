module.exports = {
  closureLibraryDir: "node_modules/google-closure-library",
  inputsRoot: "js",
  depsJs: "build/deps.js",
  depsJsIgnoreDirs: ["node_modules", "build"],
  entryConfigDir: "entry-config/entries",
  // http2: true,
  // https: {
  //   keyPath: "./duck-key.pem",
  //   certPath: "./duck-cert.pem",
  // },
  batchOptions: {
    region: "ap-northeast-1",
    awsLambdaOptions: {
      Runtime: "nodejs18.x",
    },
    include: ["js", "node_modules/google-closure-library"],
    exclude: [],
  },
};
