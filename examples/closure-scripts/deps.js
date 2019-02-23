goog.addDependency('../../../../app.js', ['app'], ['app.script1', 'goog.ui.DatePicker'], {'lang': 'es6'});
goog.addDependency('../../../../esm1.js', ['app.esm1'], ['../../../../esm2.js'], {'lang': 'es6', 'module': 'es6'});
goog.addDependency('../../../../esm2.js', [], [], {'lang': 'es6', 'module': 'es6'});
goog.addDependency('../../../../module1.js', ['app.module1'], ['app.esm1', 'goog.dom.uri'], {'lang': 'es6', 'module': 'goog'});
goog.addDependency('../../../../script1.js', ['app.script1'], ['app.module1'], {});

