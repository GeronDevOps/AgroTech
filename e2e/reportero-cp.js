/**
 * Reportero de trazabilidad CP → resultado (AGRO-14).
 * Cruza el catálogo de casos (casos.js) con las pruebas etiquetadas @CP-xx y escribe:
 *   resultados/informe-cp.md    matriz lista para pegar en el informe de pruebas (Entrega 4)
 *   resultados/informe-cp.json  los mismos datos para otras herramientas
 * Un caso PASA solo si todas sus pruebas pasaron en todos los proyectos donde se ejecutó.
 */
const fs = require('node:fs');
const path = require('node:path');
const casos = require('./casos');
const { API, WEB, local } = require('./entorno');

const ETIQUETA = /^@?(CP-\d{2}|RNF-\d{2})$/;

class ReporteroCP {
  constructor(opciones = {}) {
    this.salida = opciones.salida || 'resultados/informe-cp.md';
    this.pruebas = new Map(); // id de prueba → registro (se queda con el último reintento)
    this.inicio = new Date();
  }

  onBegin(config) { this.raiz = config.rootDir; }

  onTestEnd(test, result) {
    const etiquetas = [...(test.tags || [])].map((t) => t.replace(/^@/, '')).filter((t) => ETIQUETA.test(t));
    if (!etiquetas.length) return;
    const anotaciones = [...(result.annotations || []), ...(test.annotations || [])];
    const vistas = new Set();
    const mediciones = anotaciones
      .filter((a) => a.type === 'medición' && a.description && !vistas.has(a.description) && vistas.add(a.description))
      .map((a) => a.description);
    this.pruebas.set(test.id, {
      titulo: test.title,
      proyecto: test.parent.project() ? test.parent.project().name : '',
      archivo: path.relative(this.raiz || process.cwd(), test.location.file),
      etiquetas,
      estado: result.status, // passed | failed | timedOut | skipped | interrupted
      esperado: test.expectedStatus,
      duracionMs: result.duration,
      mediciones,
      error: result.error ? String(result.error.message || '').split('\n')[0].replace(/\u001b\[[0-9;]*m/g, '').slice(0, 200) : null,
    });
  }

  onEnd(resultado) {
    const pruebas = [...this.pruebas.values()];
    const filas = casos.map((c) => {
      const propias = pruebas.filter((p) => p.etiquetas.includes(c.id));
      const ejecutadas = propias.filter((p) => p.estado !== 'skipped');
      const fallidas = ejecutadas.filter((p) => p.estado !== p.esperado);
      let veredicto;
      if (c.modo === 'manual' && !ejecutadas.length) veredicto = 'MANUAL';
      else if (!propias.length) veredicto = 'SIN PRUEBA';
      else if (!ejecutadas.length) veredicto = 'OMITIDO';
      else veredicto = fallidas.length ? 'FALLA' : 'PASA';
      return {
        ...c,
        veredicto,
        proyectos: [...new Set(ejecutadas.map((p) => p.proyecto))],
        pasadas: ejecutadas.length - fallidas.length,
        total: ejecutadas.length,
        mediciones: propias.flatMap((p) => p.mediciones),
        fallas: fallidas.map((p) => `${p.titulo}: ${p.error || p.estado}`),
        pruebas: propias.map(({ titulo, proyecto, archivo, estado, duracionMs }) => ({ titulo, proyecto, archivo, estado, duracionMs })),
      };
    });
    const extra = pruebas.filter((p) => p.etiquetas.some((e) => e.startsWith('RNF-')));
    const cuenta = (v) => filas.filter((f) => f.veredicto === v).length;

    const md = [];
    md.push('# Informe de pruebas de sistema · AgroTech v1.1.0 (MVP + Fase 2 del SRS)', '');
    md.push(`- **Fecha:** ${this.inicio.toISOString().replace('T', ' ').slice(0, 16)} UTC`);
    md.push(`- **Entorno:** ${local ? 'local (API y app web levantadas por Playwright)' : 'servidor desplegado'} · API \`${API}\` · Web \`${WEB}\``);
    md.push(`- **Resultado global de la ejecución:** ${resultado.status} · duración ${(resultado.duration / 1000).toFixed(1)} s`);
    md.push(`- **Casos:** ${filas.length} · PASA ${cuenta('PASA')} · FALLA ${cuenta('FALLA')} · MANUAL ${cuenta('MANUAL')} · OMITIDO ${cuenta('OMITIDO')} · SIN PRUEBA ${cuenta('SIN PRUEBA')}`, '');
    md.push('## Matriz de trazabilidad', '');
    md.push('| CP | CU / RNF | Tipo | Resultado esperado | Ejecución | Veredicto | Pruebas | Mediciones |');
    md.push('|---|---|---|---|---|---|---|---|');
    const celda = (t) => String(t).replace(/\|/g, '\\|').replace(/\n/g, ' ');
    for (const f of filas) {
      const ejec = f.modo === 'manual' ? 'Manual' : (f.proyectos.join(' + ') || f.modo);
      md.push(`| ${f.id} | ${f.cu} | ${f.tipo} | ${celda(f.esperado)} | ${ejec} | **${f.veredicto}** | ${f.total ? `${f.pasadas}/${f.total}` : '—'} | ${celda(f.mediciones.join('; ') || '—')} |`);
    }
    if (extra.length) {
      md.push('', '## Requisitos no funcionales verificados adicionalmente', '');
      md.push('| RNF | Prueba | Proyecto | Estado |', '|---|---|---|---|');
      for (const p of extra) md.push(`| ${p.etiquetas.filter((e) => e.startsWith('RNF-')).join(', ')} | ${celda(p.titulo)} | ${p.proyecto} | ${p.estado === p.esperado ? 'PASA' : 'FALLA'} |`);
    }
    const manuales = filas.filter((f) => f.veredicto === 'MANUAL');
    if (manuales.length) {
      md.push('', '## Casos que requieren ejecución manual', '');
      for (const f of manuales) md.push(`- **${f.id}** (${f.prueba}) → ${f.comoSeEjecuta || 'Ver plan de pruebas.'}`);
    }
    const conFallas = filas.filter((f) => f.fallas.length);
    if (conFallas.length) {
      md.push('', '## Fallas', '');
      for (const f of conFallas) for (const x of f.fallas) md.push(`- **${f.id}** · ${celda(x)}`);
    }
    md.push('', '## Detalle por prueba', '');
    md.push('| CP | Prueba | Proyecto | Archivo | Estado | Duración |', '|---|---|---|---|---|---|');
    for (const f of filas) for (const p of f.pruebas) md.push(`| ${f.id} | ${celda(p.titulo)} | ${p.proyecto} | \`${p.archivo}\` | ${p.estado} | ${(p.duracionMs / 1000).toFixed(1)} s |`);
    md.push('', '_Generado por `e2e/reportero-cp.js`. Evidencias (trazas y capturas de las fallas) en `informe-html/`._', '');

    const destino = path.resolve(this.raiz || process.cwd(), this.salida);
    fs.mkdirSync(path.dirname(destino), { recursive: true });
    fs.writeFileSync(destino, md.join('\n'));
    fs.writeFileSync(destino.replace(/\.md$/, '.json'), JSON.stringify({ fecha: this.inicio, estado: resultado.status, casos: filas, rnf: extra }, null, 2));
    console.log(`\nInforme de casos de prueba: ${path.relative(process.cwd(), destino)} (PASA ${cuenta('PASA')}/${filas.length}, FALLA ${cuenta('FALLA')}, MANUAL ${cuenta('MANUAL')})`);
  }

  printsToStdio() { return false; }
}

module.exports = ReporteroCP;
