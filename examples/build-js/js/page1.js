goog.provide("app.page1");

goog.require("app.module1");
goog.require("app.script1");

document.getElementById("output").textContent =
  "from app.page1: " + app.script1 + ", " + app.module1.getMessage();
