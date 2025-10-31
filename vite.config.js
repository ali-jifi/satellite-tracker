import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  worker: {
    format: 'es'
  },
  server: {
    proxy: {
      '/api/spacetrack': {
        target: 'https://www.space-track.org',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/spacetrack/, ''),
        configure: (proxy, options) => {
          proxy.on('proxyReq', (proxyReq, req, res) => {
            //add headers for Space-Track.org
            proxyReq.setHeader('User-Agent', 'Mozilla/5.0');

            //forward cookies from browser
            if (req.headers.cookie) {
              proxyReq.setHeader('Cookie', req.headers.cookie);
            }
          });

          proxy.on('proxyRes', (proxyRes, req, res) => {
            //forward set-cookie headers back to browser
            if (proxyRes.headers['set-cookie']) {
              res.setHeader('Set-Cookie', proxyRes.headers['set-cookie']);
            }
          });
        }
      }
    }
  }
})