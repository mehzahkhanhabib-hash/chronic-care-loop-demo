const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
module.exports = (env, argv) => ({
  entry: './src/index.jsx',
  output: { path: path.resolve(__dirname, 'dist'), filename: 'assets/[name].[contenthash].js', publicPath: argv.mode === 'production' ? '/studio/' : '/', clean: true },
  resolve: { extensions: ['.js', '.jsx'] },
  module: { rules: [
    { test: /\.jsx?$/, exclude: /node_modules/, use: 'babel-loader' },
    { test: /\.css$/, use: ['style-loader', 'css-loader'] },
    { test: /\.(png|jpe?g|gif|svg|woff2?)$/, type: 'asset' },
  ] },
  plugins: [new HtmlWebpackPlugin({ template: './public/index.html', title: 'Chronic Care Studio' })],
  devtool: argv.mode === 'production' ? false : 'eval-cheap-module-source-map',
  devServer: { port: Number(process.env.STUDIO_PORT || 3000), historyApiFallback: true, hot: true, open: false,
    proxy: [{ context: ['/api'], target: 'http://localhost:' + (process.env.PORT || 4000), changeOrigin: true }] },
  performance: { hints: false },
});
