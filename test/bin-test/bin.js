'use strict';

const assert = require('assert');
const path = require('path');
const {execFile} = require('child_process');
const {promisify} = require('util');

const execFileP = promisify(execFile);
const bin = path.resolve(__dirname, '..', '..', 'bin', 'duck.js');

// Run this test after tsc
describe('bin/duck.js', () => {
  it('is executable', async () => {
    const {stderr} = await execFileP(bin, ['--help']);
    assert.equal(stderr, '');
  });
});
