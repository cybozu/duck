goog.provide("app.page1");

goog.require("app.soy.simple");

document.getElementById("output").textContent = app.soy.simple.helloWorld();
