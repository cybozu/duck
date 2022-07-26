goog.provide("app.chunks");

goog.require("goog.html.legacyconversions");
goog.require("goog.module.ModuleLoader");
goog.require("goog.module.ModuleManager");

goog.scope(() => {
  const moduleManager = goog.module.ModuleManager.getInstance();
  const moduleLoader = new goog.module.ModuleLoader();
  // moduleLoader.setDebugMode(!!goog.global["PLOVR_MODULE_USE_DEBUG_MODE"]);
  moduleLoader.setDebugMode(true);
  moduleManager.setLoader(moduleLoader);
  moduleManager.setAllModuleInfo(goog.global["PLOVR_MODULE_INFO"]);
  const trustedModuleUris = {};
  for (const id in goog.global["PLOVR_MODULE_URIS"]) {
    if (
      Object.prototype.hasOwnProperty.call(goog.global["PLOVR_MODULE_URIS"], id)
    ) {
      trustedModuleUris[id] = [
        goog.html.legacyconversions.trustedResourceUrlFromString(
          goog.global["PLOVR_MODULE_URIS"][id]
        ),
      ];
    }
  }
  moduleManager.setModuleTrustedUris(trustedModuleUris);
  moduleManager.getModuleInfo("chunks").setLoaded();

  function output(msg) {
    const el = document.getElementById("output");
    el.textContent += `${msg}\n`;
  }

  document.getElementById("chunk1").addEventListener("click", () => {
    moduleManager.execOnLoad("chunk1", () => {
      const msg = app.chunk1.getMessage();
      output(msg);
    });
  });

  document.getElementById("chunk2").addEventListener("click", () => {
    moduleManager.execOnLoad("chunk2", () => {
      const msg = app.chunk2.getMessage();
      output(msg);
    });
  });
});
