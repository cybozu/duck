import { strict as assert } from "assert";
import { toSoyArgs } from "../src/soy";

describe("soy", () => {
  describe("toSoyArgs", () => {
    it("converts SoyConfig", () => {
      const config = {
        soyFileRoots: [],
        soyJarPath: "/soy.jar",
        soyClasspaths: ["/plugin1.jar", "/plugin2.jar"],
        soyOptions: {
          outputPathFormat: "{INPUT_DIRECTORY}/{INPUT_FILE_NAME_NO_EXT}.soy.js",
          shouldProvideRequireSoyNamespaces: true,
          bidiGlobalDir: 1 as const,
          pluginModules: ["com.example.Foo", "com.example.Bar"],
        },
      };
      assert.deepEqual(toSoyArgs(["/js/foo.soy", "/js/bar.soy"], config), [
        "-classpath",
        "/soy.jar:/plugin1.jar:/plugin2.jar",
        "com.google.template.soy.SoyToJsSrcCompiler",
        "--outputPathFormat",
        "{INPUT_DIRECTORY}/{INPUT_FILE_NAME_NO_EXT}.soy.js",
        "--shouldProvideRequireSoyNamespaces",
        "--bidiGlobalDir",
        "1",
        "--pluginModules",
        "com.example.Foo,com.example.Bar",
        "--srcs",
        "/js/foo.soy,/js/bar.soy",
      ]);
    });
  });
});
