/**
 * Reportero del banco de pruebas: cruza banco/banco.js con la ejecución y escribe
 *   resultados/banco/banco.json  (cada caso con resultado, duración, mediciones, traza HTTP y capturas)
 *   resultados/banco/banco.md    (resumen y matriz para el documento)
 */
const fs = require('node:fs');
const path = require('node:path');
const { banco, TECNICAS } = require('./banco/banco');

class ReporteroBanco {
  constructor(opciones = {}) {
    this.salida = opciones.salida || 'resultados/banco';
    this.resultados = new Map();
    this.inicio = new Date();
  }

  onTestEnd(prueba, resultado) {
    const etiqueta = prueba.tags.find((t) => /^@BP-\d{3}$/.test(t));
    if (!etiqueta) return;
    const id = etiqueta.slice(1);
    const traza = resultado.attachments.find((a) => a.name === 'traza');
    const r = {
      estado: resultado.status,
      ms: resultado.duration,
      proyecto: prueba.parent.project().name,
      mediciones: prueba.annotations.filter((a) => a.type === 'medición').map((a) => a.description),
      traza: traza ? JSON.parse(traza.body.toString()) : [],
      capturas: resultado.attachments.filter((a) => a.name.startsWith('captura: ')).map((a) => path.basename(a.path)),
      error: resultado.error ? String(resultado.error.message || '').replace(/\x1b\[[0-9;]*m/g, '').split('\n').slice(0, 4).join(' ') : null,
    };
    // Si se reintenta, cuenta el último intento.
    this.resultados.set(id, r);
  }

  onEnd() {
    const casos = banco.map((c) => {
      const r = this.resultados.get(c.id);
      let veredicto = 'NO EJECUTADO';
      if (c.nivel === 'MANUAL') veredicto = 'PENDIENTE (piloto)';
      else if (r) veredicto = r.estado === 'passed' ? 'PASA' : r.estado === 'skipped' ? 'OMITIDO' : 'FALLA';
      return { ...c, tecnicaNombre: TECNICAS[c.tecnica], veredicto, ejecucion: r || null };
    });
    const cuenta = (v) => casos.filter((x) => x.veredicto === v).length;
    const resumen = {
      fecha: this.inicio.toISOString(),
      total: casos.length,
      automatizados: casos.filter((x) => x.nivel !== 'MANUAL').length,
      pasa: cuenta('PASA'), falla: cuenta('FALLA'), omitido: cuenta('OMITIDO'), noEjecutado: cuenta('NO EJECUTADO'), manual: cuenta('PENDIENTE (piloto)'),
      llamadasHttp: casos.reduce((n, x) => n + (x.ejecucion ? x.ejecucion.traza.length : 0), 0),
      capturas: casos.reduce((n, x) => n + (x.ejecucion ? x.ejecucion.capturas.length : 0), 0),
    };
    fs.mkdirSync(this.salida, { recursive: true });
    fs.writeFileSync(path.join(this.salida, 'banco.json'), JSON.stringify({ resumen, casos }, null, 2));
    const md = [
      '# Banco de pruebas del sistema · AgroTech v1.1.0 · resultado de la ejecución', '',
      `- **Fecha:** ${resumen.fecha}`,
      `- **Casos:** ${resumen.total} (${resumen.automatizados} automatizados, ${resumen.manual} manuales del piloto)`,
      `- **Resultado:** PASA ${resumen.pasa} · FALLA ${resumen.falla} · OMITIDO ${resumen.omitido} · NO EJECUTADO ${resumen.noEjecutado}`,
      `- **Evidencias:** ${resumen.llamadasHttp} llamadas HTTP registradas · ${resumen.capturas} capturas`, '',
      '| ID | Módulo | Requisito | Técnica | Nivel | Caso | Resultado | Tiempo |', '|---|---|---|---|---|---|---|---|',
      ...casos.map((x) => `| ${x.id} | ${x.modulo} | ${x.req} | ${x.tecnicaNombre} | ${x.nivel} | ${x.titulo} | ${x.veredicto} | ${x.ejecucion ? `${(x.ejecucion.ms / 1000).toFixed(1)} s` : '—'} |`),
      '',
    ];
    fs.writeFileSync(path.join(this.salida, 'banco.md'), md.join('\n'));
    console.log(`\nBanco de pruebas: ${path.join(this.salida, 'banco.md')} (PASA ${resumen.pasa}/${resumen.automatizados}, FALLA ${resumen.falla}, MANUAL ${resumen.manual})`);
  }
}

module.exports = ReporteroBanco;
