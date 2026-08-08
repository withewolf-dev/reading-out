// Learn more https://docs.expo.io/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// The bundled library ships as .txt — Metro's default asset list stops at .html
// and .pdf, so without this the books resolve as source files and fail to parse.
config.resolver.assetExts.push('txt');

module.exports = config;
