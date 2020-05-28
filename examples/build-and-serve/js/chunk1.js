goog.provide("app.chunk1");

goog.require("goog.module.ModuleManager");
goog.require("goog.ui.Component");

/**
 * @return {string}
 */
app.chunk1.getMessage = function () {
  return "from chunk1";
};

goog.scope(() => {
  const component = new goog.ui.Component();
  component.render(goog.dom.getElement("sandbox"));

  const manager = goog.module.ModuleManager.getInstance();
  manager.beforeLoadModuleCode("chunk1");
  manager.setLoaded();
});
