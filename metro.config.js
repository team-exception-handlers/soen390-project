const { getDefaultConfig } = require("expo/metro-config");

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Enable SVGs to be imported as React components
config.transformer.babelTransformerPath = require.resolve(
  "react-native-svg-transformer",
);

const { assetExts, sourceExts } = config.resolver;
config.resolver.assetExts = assetExts.filter((ext) => ext !== "svg");
config.resolver.sourceExts = [...sourceExts, "svg"];

module.exports = config;

