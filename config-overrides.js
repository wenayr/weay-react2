// этот файл используется для конфигурации react-app-rewired
const path = require('path');

module.exports = function override (config, env) {
    console.log('override webpack fallback');

    // Проверяем аргумент запуска через process.argv
    const isTestEntry = process.argv.some(arg => arg.includes('--test'));

    // config.entry = path.resolve(__dirname, 'src/test.ts');
    config.entry = isTestEntry ? './src/test.ts' : `./src/index.ts`

    config.devServer = {
        client: {
            overlay: {
                errors: true,
                    warnings: false,
                    runtimeErrors: true,
            },
        },
    }

    let loaders = config.resolve
    loaders.fallback = {
        "fs": false,
        "tls": false,
        "net": false,
        //"http": require.resolve("stream-http"),
        "https": false,
        //"zlib": require.resolve("browserify-zlib") ,
        "path": require.resolve("path-browserify"),
        //"stream": require.resolve("stream-browserify"),
        //"util": require.resolve("util/"),
        //"crypto": require.resolve("crypto-browserify")
    }
    return config
}
