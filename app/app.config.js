// Configuración dinámica sobre app.json.
// RF-16a: el push de Android necesita google-services.json del proyecto de Firebase. No se sube al repositorio:
// en EAS se entrega como variable de tipo archivo GOOGLE_SERVICES_JSON; en local basta con dejarlo en app/.
const fs = require('node:fs');
const path = require('node:path');

module.exports = ({ config }) => {
  const local = path.join(__dirname, 'google-services.json');
  const archivo = process.env.GOOGLE_SERVICES_JSON || (fs.existsSync(local) ? './google-services.json' : undefined);
  return { ...config, android: { ...config.android, ...(archivo ? { googleServicesFile: archivo } : {}) } };
};
