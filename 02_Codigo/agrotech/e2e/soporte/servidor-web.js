/**
 * Servidor estático de la app compilada para web (app/dist), con las cabeceras de aislamiento
 * (COOP/COEP) que exige SQLite en WebAssembly. Rutas desconocidas → index.html (navegación de Expo Router).
 */
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const RAIZ = path.resolve(__dirname, '../../app/dist');
const PUERTO = Number(process.env.PUERTO_WEB || 8090);
const TIPOS = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css', '.json': 'application/json',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.ttf': 'font/ttf', '.wasm': 'application/wasm',
};

http.createServer((req, res) => {
  const ruta = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  let archivo = path.join(RAIZ, ruta);
  if (!archivo.startsWith(RAIZ)) { res.writeHead(403).end(); return; }
  if (!fs.existsSync(archivo) || fs.statSync(archivo).isDirectory()) archivo = path.join(RAIZ, 'index.html');
  res.writeHead(200, {
    'Content-Type': TIPOS[path.extname(archivo)] || 'application/octet-stream',
    'Cross-Origin-Opener-Policy': 'same-origin',
    'Cross-Origin-Embedder-Policy': 'credentialless',
  });
  fs.createReadStream(archivo).pipe(res);
}).listen(PUERTO, () => console.log(`[web] app en http://localhost:${PUERTO}`));
