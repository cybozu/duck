goog.module("app.module1");
goog.module.declareLegacyNamespace();

/**
 * @return {string}
 */
const getMessage = () => {
  return "from app.module1";
};

exports = { getMessage };
