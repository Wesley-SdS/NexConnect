const nodeExternals = require('webpack-node-externals');
const path = require('path');

module.exports = function (options) {
  return {
    ...options,
    externals: [
      // Externaliza TUDO de node_modules, incluindo dependências transitivas
      // das libs @nexconnect/*, MAS ainda bundlea o código-fonte das libs
      function ({ context, request }, callback) {
        // Sempre bundlear o source code das libs @nexconnect/*
        if (/^@nexconnect\//.test(request)) {
          return callback();
        }
        // Sempre bundlear imports relativos (código da app)
        if (request.startsWith('.') || request.startsWith('/') || path.isAbsolute(request)) {
          return callback();
        }
        // Tudo mais é external (node_modules)
        return callback(null, 'commonjs ' + request);
      },
    ],
  };
};
