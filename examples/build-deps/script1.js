goog.provide("app.script1");

goog.require("app.module1");

goog.scope(function() {
  const module1 = goog.module.get("app.module1");
  app.script1 = `from app.script1 ${module1}`;
});
