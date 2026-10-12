// Sentry's Metro config gives each bundle a debug ID so uploaded source maps match crash reports.
const { getSentryExpoConfig } = require("@sentry/react-native/metro");

module.exports = getSentryExpoConfig(__dirname);
