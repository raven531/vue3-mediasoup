const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const { VueLoaderPlugin } = require('vue-loader');

module.exports = {
    entry: './src/main.js',
    output: {
        path: path.resolve(__dirname, 'dist'),
        filename: 'bundle.js',
        publicPath: '/'
    },
    module: {
        rules: [
            {
                test: /\.js$/,
                exclude: /node_modules/,
                use: {
                    loader: 'babel-loader',
                    options: {
                        presets: ['@babel/preset-env']
                    }
                }
            },
            {
                test: /\.vue$/,
                loader: 'vue-loader'
            },
            {
                test: /\.css$/,
                use: ['style-loader', 'css-loader']
            },
            {
                test: /\.(png|jpg|jpeg|gif|svg)$/,
                type: 'asset/resource'
            }
        ]
    },
    resolve: {
        alias: {
            '@': path.resolve(__dirname, 'src')
        },
        extensions: ['.js', '.vue', '.json']
    },
    plugins: [
        new HtmlWebpackPlugin({
            template: './public/index.html'
        }),
        new VueLoaderPlugin()
    ],
    devServer: {
        static: {
            directory: path.join(__dirname, 'public'),
        },
        hot: true,
        port: 8080,
        https: true,
        proxy: {
            '/socket.io': {
                target: 'https://localhost:3016',
                secure: false,
                ws: true
            },
            '/api': {
                target: 'https://localhost:3016',
                secure: false
            }
        }
    }
}; 