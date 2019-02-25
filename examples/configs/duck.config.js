const path = require('path');

module.exports = {
  closureLibraryDir: path.dirname(require.resolve('google-closure-library/package.json')),
  inputsRoot: __dirname,
  entryConfigDir: path.join(__dirname, 'duck-configs', 'entries'),
};
