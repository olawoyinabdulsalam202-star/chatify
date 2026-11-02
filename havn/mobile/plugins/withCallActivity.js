const { withAndroidManifest } = require("@expo/config-plugins");

module.exports = function withCallActivity(config) {
  return withAndroidManifest(config, (mod) => {
    const app = mod.modResults.manifest.application?.[0];
    const activities = app?.activity || [];
    const main = activities.find((activity) => activity.$?.["android:name"] === ".MainActivity") || activities[0];
    if (main) {
      main.$["android:showWhenLocked"] = "true";
      main.$["android:turnScreenOn"] = "true";
    }
    app.service = app.service || [];
    const callService = app.service.find((service) => service.$?.["android:name"] === "app.notifee.core.ForegroundService");
    if (callService) callService.$["android:foregroundServiceType"] = "camera|microphone";
    else app.service.push({ $: { "android:name": "app.notifee.core.ForegroundService", "android:exported": "false", "android:foregroundServiceType": "camera|microphone" } });
    return mod;
  });
};
