goog.module("app.chunk2");
goog.module.declareLegacyNamespace();

const ModuleManager = goog.require("goog.module.ModuleManager");

/**
 * @return {string}
 */
const getMessage = () => {
  return "from chunk2";
};

const manager = ModuleManager.getInstance();
manager.beforeLoadModuleCode("chunk2");
manager.setLoaded();

exports = { getMessage };
