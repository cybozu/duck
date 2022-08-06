import { strict as assert } from "assert";
import { calcOutputPath, toSoyArgs } from "../src/soy";

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
  describe("calcOutputPath", () => {
    it("throws an error when srcs is relative", () => {
      assert.throws(() => {
        calcOutputPath("src/js/file.soy", {});
      }, /absolute/i);
    });
    describe("outputDirectory", () => {
      it("ignores outputDirectory when inputRoots is not specified", () => {
        const actual = calcOutputPath("/src/js/file.soy", {
          outputDirectory: "/src/js/soy",
        });
        assert.equal(actual, "/src/js/file.soy.js");
      });
      it("joins outputDirectory and a relative path from inputRoots to srcs", () => {
        const actual = calcOutputPath("/src/js/path/to/file.soy", {
          outputDirectory: "/src/js/soy",
          inputRoots: ["/src/js"],
        });
        assert.equal(actual, "/src/js/soy/path/to/file.soy.js");
      });
      it("ignores an inputRoot when srcs doesn't start with it", () => {
        const actual = calcOutputPath("/src/js/path/to/file.soy", {
          outputDirectory: "/src/js/soy",
          inputRoots: ["/hoge", "/fuga"],
        });
        assert.equal(actual, "/src/js/path/to/file.soy.js");
      });
    });
    describe("outputPathFormat", () => {});
  });
});
