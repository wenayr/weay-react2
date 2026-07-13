// HTTPS stand config for QA that needs a secure context over LAN (getUserMedia on
// real cameras/mics, mobile devices on the same network). Self-signed cert via
// @vitejs/plugin-basic-ssl - accept the browser warning once.
// Run: npx vite -c vite.https.config.ts --host --port 3010
import baseConfig from './vite.config';
import basicSsl from '@vitejs/plugin-basic-ssl';

export default {
    ...baseConfig,
    plugins: [...(baseConfig.plugins ?? []), basicSsl()],
};
