'use strict';

module.exports = {
  packagerConfig: {
    asar: true,
    name: 'Whithin',
    executableName: 'Whithin'
  },
  rebuildConfig: {},
  makers: [
    {
      name: '@electron-forge/maker-squirrel',
      config: {
        name: 'whithin_desktop',
        authors: 'Whithin',
        description: 'Whithin messenger desktop shell'
      }
    },
    {
      name: '@electron-forge/maker-zip',
      platforms: ['win32', 'darwin', 'linux']
    }
  ],
  plugins: []
};
