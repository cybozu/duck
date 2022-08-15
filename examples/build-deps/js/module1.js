goog.module("app.module1");

// ES Module
const esm1 = goog.require("app.esm1");
// Closure Module
const { normalizeUri } = goog.require("goog.dom.uri");

exports = `from app.module1 ${esm1.default} ${normalizeUri("../foo/../bar")}`;
