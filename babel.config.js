module.exports = function (api) {
  api.cache(true);
  return {
    presets: ["babel-preset-expo", "babel-plugin-syntax-jsx", "babel-preset-react"],
  };
};
