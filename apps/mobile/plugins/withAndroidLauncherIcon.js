const {withFinalizedMod} = require('@expo/config-plugins');
const fs = require('node:fs/promises');
const path = require('node:path');

// Keep the approved raster artwork unchanged. Android applies the launcher mask;
// a native inset keeps the complete mark inside that mask without a legacy tile.
module.exports = function withAndroidLauncherIcon(config) {
  return withFinalizedMod(config, ['android', async (mod) => {
    const res = path.join(mod.modRequest.platformProjectRoot, 'app/src/main/res');
    await fs.mkdir(path.join(res, 'drawable'), {recursive: true});
    await fs.writeFile(path.join(res, 'drawable/arviva_launcher_foreground.xml'), `<?xml version="1.0" encoding="utf-8"?>
<inset xmlns:android="http://schemas.android.com/apk/res/android"
    android:drawable="@mipmap/ic_launcher_foreground"
    android:insetLeft="12.5%" android:insetTop="12.5%"
    android:insetRight="12.5%" android:insetBottom="12.5%" />\n`);
    for (const name of ['ic_launcher.xml', 'ic_launcher_round.xml']) {
      const file = path.join(res, 'mipmap-anydpi-v26', name);
      const xml = await fs.readFile(file, 'utf8');
      await fs.writeFile(file, xml.replace('@mipmap/ic_launcher_foreground', '@drawable/arviva_launcher_foreground'));
    }
    return mod;
  }]);
};
