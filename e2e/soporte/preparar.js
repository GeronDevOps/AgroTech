/**
 * npm run preparar — deja listo el entorno local de las pruebas de sistema:
 * 1) crea la base E2E si no existe y aplica las migraciones; 2) crea el administrador de pruebas (Fase 2);
 * 3) compila la app web apuntando a la API de pruebas.
 */
const { execSync } = require('node:child_process');
const path = require('node:path');
const { API, BASE_DATOS, ADMIN } = require('../entorno');

const api = path.resolve(__dirname, '../../api');
const app = path.resolve(__dirname, '../../app');
const sh = (cmd, cwd, env = {}) => execSync(cmd, { cwd, stdio: 'inherit', env: { ...process.env, ...env } });

const url = new URL(BASE_DATOS);
const nombre = url.pathname.slice(1);
url.pathname = '/postgres';
sh(`node -e "const {Client}=require('pg');const c=new Client({connectionString:'${url}'});c.connect().then(()=>c.query(\\"SELECT 1 FROM pg_database WHERE datname='${nombre}'\\")).then(r=>r.rowCount?null:c.query('CREATE DATABASE ${nombre}')).then(()=>c.end())"`, api);
sh('node src/db/migrate.js', api, { DATABASE_URL: BASE_DATOS, JWT_SECRETO: 'e2e-secreto-de-pruebas-de-sistema-0123456789' });
// Fase 2 · CP-30: cuenta de administrador del panel (si ya existe, el script lo informa y se sigue).
try {
  sh(`node scripts/crear-admin.js --correo ${ADMIN.correo} --telefono ${ADMIN.telefono} --nombres Admin --apellidos E2E --municipio Pamplona`, api, {
    DATABASE_URL: BASE_DATOS, JWT_SECRETO: 'e2e-secreto-de-pruebas-de-sistema-0123456789', ADMIN_CONTRASENA: ADMIN.contrasena, BCRYPT_COSTO: '10',
  });
} catch { console.log('[preparar] el administrador de pruebas ya existía'); }
sh('npx expo export --platform web --output-dir dist', app, { EXPO_PUBLIC_API_URL: API, EXPO_OFFLINE: '1' });
console.log('\n[preparar] Listo: base de datos migrada y app web compilada contra', API);
