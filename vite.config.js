import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import cesium from 'vite-plugin-cesium'

export default defineConfig({
  plugins: [react(), cesium()],
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
            proxyReq.setHeader('User-Agent', 'Mozilla/5.0');
            if (req.headers.cookie) {
              proxyReq.setHeader('Cookie', req.headers.cookie);
            }
          });
          proxy.on('proxyRes', (proxyRes, req, res) => {
            if (proxyRes.headers['set-cookie']) {
              res.setHeader('Set-Cookie', proxyRes.headers['set-cookie']);
            }
          });
        }
      },
      '/api/satnogs': {
        target: 'https://db.satnogs.org',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/satnogs/, ''),
      },
      '/api/tle': {
        target: 'https://tle.ivanstanojevic.me',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/tle/, ''),
      }
    }
  }
})