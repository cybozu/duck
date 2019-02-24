goog.provide('app.chunk1');

goog.require('goog.module.ModuleManager');

/**
 * @return {string}
 */
app.chunk1.getMessage = function() {
  return 'from chunk1';
};

goog.scope(() => {
  const manager = goog.module.ModuleManager.getInstance();
  manager.beforeLoadModuleCode('chunk1');
  manager.setLoaded();
});
