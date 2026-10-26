// SPDX-License-Identifier: AGPL-3.0-or-later
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  { ignores: ['dist/*', 'vendor/*', 'android/*', 'ios/*'] },
]);
