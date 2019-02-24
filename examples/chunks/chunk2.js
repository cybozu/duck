goog.provide('chunks.chunk2');

goog.require('goog.module.ModuleManager');

/**
 * @return {string}
 */
chunks.chunk2.getMessage = function() {
  return 'from chunk2';
};

goog.scope(() => {
  const manager = goog.module.ModuleManager.getInstance();
  manager.beforeLoadModuleCode('chunk2');
  manager.setLoaded();
});
