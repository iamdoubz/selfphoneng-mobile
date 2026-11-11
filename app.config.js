// SPDX-License-Identifier: AGPL-3.0-or-later
// app.json, plus the commit and time of this build for Settings → About (read via expo-constants).
const { execSync } = require('node:child_process');

const git = (args) => {
  try {
    return execSync(`git ${args}`, { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim();
  } catch {
    return '';
  }
};

module.exports = ({ config }) => ({
  ...config,
  extra: {
    ...config.extra,
    commit: git('rev-parse HEAD') || process.env.GITHUB_SHA || null,
    builtAt: new Date().toISOString(),
  },
});
