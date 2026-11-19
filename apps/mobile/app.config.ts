import { t } from '../../packages/config/src/copy.ts';
import { agentConfig } from '../../packages/config/src/public.ts';
import { nativeAssets as assetConfig } from '../../config/native-assets.ts';
export default {
 name:agentConfig.brand.name,slug:agentConfig.app.slug,scheme:agentConfig.app.scheme,version:agentConfig.app.version,
 orientation:'portrait',icon:assetConfig.iosIcon,userInterfaceStyle:'light',backgroundColor:agentConfig.theme.colors.paper,
 ios:{supportsTablet:true,bundleIdentifier:agentConfig.app.iosBundleId,buildNumber:agentConfig.app.iosBuild,infoPlist:{ITSAppUsesNonExemptEncryption:false}},
 android:{package:agentConfig.app.androidPackage,versionCode:agentConfig.app.androidVersionCode,adaptiveIcon:{foregroundImage:assetConfig.androidIcon,backgroundColor:agentConfig.theme.colors.teal}},
 web:{bundler:'metro',output:'single',favicon:assetConfig.favicon},
 plugins:[['expo-splash-screen',{image:assetConfig.splash,backgroundColor:agentConfig.theme.colors.paper}],'expo-router','expo-secure-store','expo-localization',...(agentConfig.features.uploads?[['expo-image-picker',{photosPermission:t('permission.photos'),cameraPermission:t('permission.camera'),microphonePermission:false}]]:[]),'./plugins/withAndroidLauncherIcon'],
 extra:{company:agentConfig.brand.attribution?agentConfig.brand.company:'',website:agentConfig.brand.website}
};
