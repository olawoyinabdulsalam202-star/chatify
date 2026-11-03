const { withAndroidManifest } = require("@expo/config-plugins");

module.exports = function withCallActivity(config) {
  return withAndroidManifest(config, (mod) => {
    const manifest = mod.modResults.manifest;
    manifest.$ = manifest.$ || {};
    if (!manifest.$["xmlns:tools"]) manifest.$["xmlns:tools"] = "http://schemas.android.com/tools";

    const app = manifest.application?.[0];
    if (!app) return mod;
    app["meta-data"] = app["meta-data"] || [];
    const metadata = [
      {
        name: "com.google.firebase.messaging.default_notification_channel_id",
        attribute: "android:value",
        value: "messages",
      },
      {
        name: "com.google.firebase.messaging.default_notification_color",
        attribute: "android:resource",
        value: "@color/notification_icon_color",
      },
    ];
    metadata.forEach(({ name, attribute, value }) => {
      let entry = app["meta-data"].find((item) => item.$?.["android:name"] === name);
      if (!entry) {
        entry = { $: { "android:name": name } };
        app["meta-data"].push(entry);
      }
      entry.$[attribute] = value;
      entry.$["tools:replace"] = attribute;
    });

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
