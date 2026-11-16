'use strict';

const fs = require('node:fs/promises');
const path = require('node:path');

/**
 * Servicio de correo saliente (CU-08 código de recuperación, CU-20 aviso de supresión, CU-18 avisos de moderación).
 * Drivers (variable CORREO_DRIVER):
 *   consola  desarrollo: imprime el correo en la terminal de la API (valor por defecto)
 *   archivo  pruebas de sistema: escribe cada correo como JSON en CORREO_DIR (el "buzón" que leen las pruebas E2E)
 *   memoria  pruebas de integración: guarda los correos en `enviados`
 *   smtp     producción: Nodemailer con CORREO_SMTP_URL (p. ej. smtps://usuario:clave@smtp.servidor.co:465)
 * La interfaz es la misma en todos: enviar({ para, asunto, texto }).
 */
function createCorreo({ driver = 'consola', dir, remitente = 'AgroTech <no-responder@agrotech.co>', smtpUrl } = {}) {
  const enviados = [];

  const drivers = {
    async consola(m) {
      console.log(`[correo] Para: ${m.para} · ${m.asunto}\n${m.texto}`);
    },
    async archivo(m) {
      await fs.mkdir(dir, { recursive: true });
      const nombre = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.json`;
      // Escritura atómica: se escribe a un temporal y se renombra, para que el lector nunca vea un JSON a medias.
      const destino = path.join(dir, nombre);
      await fs.writeFile(`${destino}.tmp`, JSON.stringify({ ...m, de: remitente, fecha: new Date().toISOString() }, null, 2));
      await fs.rename(`${destino}.tmp`, destino);
    },
    async memoria(m) {
      enviados.push({ ...m, fecha: new Date() });
    },
    smtp: (() => {
      let transporte;
      return async (m) => {
        // Se carga solo si se usa: en desarrollo y pruebas no hace falta un servidor de correo.
        transporte ??= require('nodemailer').createTransport(smtpUrl);
        await transporte.sendMail({ from: remitente, to: m.para, subject: m.asunto, text: m.texto });
      };
    })(),
  };
  if (!drivers[driver]) throw new Error(`Driver de correo desconocido: ${driver}`);
  if (driver === 'archivo' && !dir) throw new Error('El driver de correo "archivo" requiere CORREO_DIR.');
  if (driver === 'smtp' && !smtpUrl) throw new Error('El driver de correo "smtp" requiere CORREO_SMTP_URL.');

  return {
    driver,
    enviados,
    async enviar({ para, asunto, texto }) {
      await drivers[driver]({ para, asunto, texto });
    },
  };
}

module.exports = { createCorreo };
