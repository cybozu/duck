module.exports = {
  closureLibraryDir: "node_modules/google-closure-library",
  inputsRoot: ".",
  depsJs: "build/deps.js",
  depsJsIgnoreDirs: ["node_modules", "build"],
  entryConfigDir: "entry-config/entries",
  soyJarPath: "closure-templates/soy-2023-07-19-SoyToJsSrcCompiler.jar",
  soyFileRoots: ["soy"],
  soySrcsRelativeFrom: "soy",
  soyOptions: {
    outputDirectory: "js/soy",
  },
};
