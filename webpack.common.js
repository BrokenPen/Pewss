const ExtractTextPlugin = require('extract-text-webpack-plugin')
const CopyWebpackPlugin = require('copy-webpack-plugin')

module.exports = {
  target: 'node',
  entry: {
    Index: `${__dirname}/Client/src/Index/Index.jsx`,
    Login: `${__dirname}/Client/src/Login/Login.jsx`
  },
  output: {
    filename: '[name].js',
    path: `${__dirname}/Build/Client`
  },
  module: {
    rules: [
      {
        test: /\.css$/,
        use: ExtractTextPlugin.extract({
          fallback: 'style-loader',
          use: 'css-loader'
        })
      },
      {
        test: /\.(jsx)$/,
        loader: 'babel-loader',
        query: {
          presets: [
            'babel-preset-env',
            'babel-preset-react'
          ]
        }
      },
      {
        test: /\.(jpg|eot|png|woff|woff2|ttf|svg)$/,
        loader: 'url-loader'
      }
    ]
  },
  plugins: [
    new ExtractTextPlugin('[name]-lib.css'),
    new CopyWebpackPlugin([
        {from: `${__dirname}/Client/Index.html`},
        {from: `${__dirname}/Client/Login.html`},
        {from: `${__dirname}/Client/src/Login/Login.css`},
        {from: `${__dirname}/Client/src/Index/Index.css`},
        {from: `${__dirname}/Client/src/Index/Editor/Editor.css`},
        {from: `${__dirname}/Client/src/Index/Simulator/Simulator.css`}
    ])
  ]
}
