const path = require('path');

module.exports = {
  closureLibraryPath: path.dirname(require.resolve('google-closure-library/package.json')),
  root: __dirname,
  pageConfigPath: path.join(__dirname, 'configs'),
};
