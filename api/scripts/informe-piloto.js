#!/usr/bin/env node
'use strict';

/**
 * npm run piloto:informe -- --sus sus.csv --tareas tareas.csv [--salida informe.md]
 *
 * Calcula los indicadores de CP-12 / RNF-02 a partir de las planillas del piloto (docs/piloto/plantillas):
 *   - SUS (Brooke, 1996): impares → respuesta − 1; pares → 5 − respuesta; suma × 2,5 (0–100).
 *     Media, desviación estándar, IC 95 % (t de Student), adjetivo (Bangor et al., 2009) y nota (Sauro y Lewis, 2016).
 *   - Éxito en tareas: solo cuenta EXITO (sin ayuda). IC 95 % de Wald ajustado (recomendado para muestras pequeñas).
 * Veredicto de CP-12: SUS medio ≥ 68 y éxito ≥ 80 % en las tareas críticas (publicar producto, confirmar pedido).
 * Acepta CSV separado por coma o por punto y coma (Excel en español).
 */
const fs = require('node:fs');

const META_SUS = 68;
const META_EXITO = 0.8;
const TAREAS_CRITICAS = ['P2', 'C3']; // guion de tareas: publicar producto (productor) y confirmar pedido (consumidor)

function leerCsv(texto) {
  const lineas = texto.replace(/^\uFEFF/, '').split(/\r?\n/)
    .map((l, i) => ({ l: l.trim(), n: i + 1 }))            // n = número de línea real del archivo
    .filter(({ l }) => l && !l.startsWith('#'));
  if (!lineas.length) return [];
  const primera = lineas[0].l;
  const sep = (primera.match(/;/g) || []).length > (primera.match(/,/g) || []).length ? ';' : ',';
  const cabecera = primera.split(sep).map((c) => c.trim().toLowerCase());
  return lineas.slice(1).map(({ l, n }) => {
    const celdas = l.split(sep).map((c) => c.trim());
    const fila = Object.fromEntries(cabecera.map((c, j) => [c, celdas[j] ?? '']));
    fila._linea = n;
    return fila;
  });
}

/** Puntaje SUS de un participante (respuestas p1…p10 de 1 a 5). */
function puntajeSus(respuestas) {
  if (respuestas.length !== 10) throw new Error('El SUS tiene 10 preguntas.');
  const suma = respuestas.reduce((s, r, i) => {
    if (!Number.isInteger(r) || r < 1 || r > 5) throw new Error(`Respuesta fuera de 1–5 en la pregunta ${i + 1}.`);
    return s + (i % 2 === 0 ? r - 1 : 5 - r);
  }, 0);
  return suma * 2.5;
}

const T95 = [12.706, 4.303, 3.182, 2.776, 2.571, 2.447, 2.365, 2.306, 2.262, 2.228, 2.201, 2.179, 2.16, 2.145, 2.131, 2.12, 2.11, 2.101, 2.093, 2.086,
  2.08, 2.074, 2.069, 2.064, 2.06, 2.056, 2.052, 2.048, 2.045, 2.042];
const tCritico = (gl) => (gl <= 30 ? T95[gl - 1] : 1.96);

function estadisticos(valores) {
  const n = valores.length;
  const media = valores.reduce((s, v) => s + v, 0) / n;
  const de = n > 1 ? Math.sqrt(valores.reduce((s, v) => s + (v - media) ** 2, 0) / (n - 1)) : 0;
  const margen = n > 1 ? tCritico(n - 1) * (de / Math.sqrt(n)) : 0;
  return { n, media, de, ic: [Math.max(0, media - margen), Math.min(100, media + margen)] };
}

/** Escala de adjetivos de Bangor, Kortum y Miller (2009). */
function adjetivoSus(m) {
  if (m >= 85.5) return 'Excelente';
  if (m >= 71.4) return 'Bueno';
  if (m >= 50.9) return 'Aceptable';
  if (m >= 35.7) return 'Pobre';
  return 'Pésimo';
}
/** Escala de notas curvada de Sauro y Lewis (2016). */
function notaSus(m) {
  const tabla = [[84.1, 'A+'], [80.8, 'A'], [78.9, 'A-'], [77.2, 'B+'], [74.1, 'B'], [72.6, 'B-'], [71.1, 'C+'], [65, 'C'], [62.7, 'C-'], [51.7, 'D']];
  const fila = tabla.find(([min]) => m >= min);
  return fila ? fila[1] : 'F';
}

/** Proporción con IC 95 % de Wald ajustado (Agresti-Coull). */
function proporcion(exitos, n) {
  const z = 1.96;
  const nAj = n + z * z;
  const pAj = (exitos + (z * z) / 2) / nAj;
  const margen = z * Math.sqrt((pAj * (1 - pAj)) / nAj);
  return { exitos, n, p: n ? exitos / n : 0, ic: [Math.max(0, pAj - margen), Math.min(1, pAj + margen)] };
}

function analizar({ sus = [], tareas = [] }) {
  const participantes = sus.map((f) => {
    const respuestas = Array.from({ length: 10 }, (_, i) => Number(f[`p${i + 1}`]));
    try {
      return { participante: f.participante, rol: (f.rol || '').toUpperCase(), puntaje: puntajeSus(respuestas) };
    } catch (err) {
      throw new Error(`sus.csv línea ${f._linea}: ${err.message}`, { cause: err });
    }
  });
  const resumenSus = participantes.length ? estadisticos(participantes.map((p) => p.puntaje)) : null;
  const porRolSus = Object.fromEntries(['PRODUCTOR', 'CONSUMIDOR'].map((rol) => {
    const v = participantes.filter((p) => p.rol === rol).map((p) => p.puntaje);
    return [rol, v.length ? estadisticos(v) : null];
  }));

  const filas = tareas.map((f) => {
    const resultado = (f.resultado || '').toUpperCase();
    if (!['EXITO', 'AYUDA', 'FALLO'].includes(resultado)) throw new Error(`tareas.csv línea ${f._linea}: resultado debe ser EXITO, AYUDA o FALLO.`);
    return { participante: f.participante, rol: (f.rol || '').toUpperCase(), tarea: (f.tarea || '').toUpperCase(), resultado, tiempo: Number(f.tiempo_s) || null, errores: Number(f.errores) || 0, toques: Number(f.toques) || null };
  });
  const codigos = [...new Set(filas.map((f) => f.tarea))].sort();
  const porTarea = codigos.map((t) => {
    const de = filas.filter((f) => f.tarea === t);
    const tiempos = de.filter((f) => f.resultado === 'EXITO' && f.tiempo).map((f) => f.tiempo);
    const toques = de.filter((f) => f.resultado === 'EXITO' && f.toques).map((f) => f.toques);
    return {
      tarea: t,
      critica: TAREAS_CRITICAS.includes(t),
      ...proporcion(de.filter((f) => f.resultado === 'EXITO').length, de.length),
      conAyuda: de.filter((f) => f.resultado === 'AYUDA').length,
      fallos: de.filter((f) => f.resultado === 'FALLO').length,
      tiempoMedio: tiempos.length ? tiempos.reduce((s, v) => s + v, 0) / tiempos.length : null,
      toquesMedio: toques.length ? toques.reduce((s, v) => s + v, 0) / toques.length : null,
      errores: de.reduce((s, f) => s + f.errores, 0),
    };
  });
  const criticas = filas.filter((f) => TAREAS_CRITICAS.includes(f.tarea));
  const exitoCriticas = proporcion(criticas.filter((f) => f.resultado === 'EXITO').length, criticas.length);
  const exitoGlobal = proporcion(filas.filter((f) => f.resultado === 'EXITO').length, filas.length);

  const cumpleSus = resumenSus ? resumenSus.media >= META_SUS : null;
  const cumpleExito = criticas.length ? exitoCriticas.p >= META_EXITO : null;
  const veredicto = cumpleSus === null || cumpleExito === null ? 'INCOMPLETO' : (cumpleSus && cumpleExito ? 'PASA' : 'FALLA');
  return { participantes, resumenSus, porRolSus, porTarea, exitoCriticas, exitoGlobal, cumpleSus, cumpleExito, veredicto };
}

const pct = (x) => `${(x * 100).toFixed(0)} %`;
const num = (x, d = 1) => (x === null || x === undefined ? '—' : x.toFixed(d).replace('.', ','));

function informeMarkdown(r, { fecha = new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Bogota' }), fuente = '' } = {}) {
  const md = [`# Informe del piloto · CP-12 (RNF-02)`, '', `- **Fecha del informe:** ${fecha}${fuente ? ` · **Datos:** ${fuente}` : ''}`];
  md.push(`- **Veredicto CP-12:** **${r.veredicto}** (meta: SUS ≥ ${META_SUS} y éxito sin ayuda ≥ ${pct(META_EXITO)} en tareas críticas)`, '');
  md.push('## SUS (System Usability Scale)', '');
  if (r.resumenSus) {
    const s = r.resumenSus;
    md.push('| Indicador | Valor |', '|---|---|');
    md.push(`| Participantes | ${s.n} |`, `| Media | **${num(s.media)}** |`, `| Desviación estándar | ${num(s.de)} |`);
    md.push(`| IC 95 % | ${num(s.ic[0])} – ${num(s.ic[1])} |`, `| Adjetivo (Bangor et al., 2009) | ${adjetivoSus(s.media)} |`);
    md.push(`| Nota (Sauro y Lewis, 2016) | ${notaSus(s.media)} |`, `| ¿Cumple ≥ ${META_SUS}? | ${r.cumpleSus ? 'Sí' : 'No'} |`);
    for (const [rol, e] of Object.entries(r.porRolSus)) if (e) md.push(`| Media ${rol.toLowerCase()}es (n = ${e.n}) | ${num(e.media)} |`);
    md.push('', '| Participante | Rol | SUS |', '|---|---|---|');
    for (const p of r.participantes) md.push(`| ${p.participante} | ${p.rol} | ${num(p.puntaje)} |`);
  } else md.push('_Sin datos de SUS._');
  md.push('', '## Éxito en tareas', '');
  if (r.porTarea.length) {
    md.push('| Tarea | Crítica | Éxito sin ayuda | IC 95 % | Con ayuda | Fallo | Tiempo medio (s) | Toques | Errores |', '|---|---|---|---|---|---|---|---|---|');
    for (const t of r.porTarea) {
      md.push(`| ${t.tarea} | ${t.critica ? 'Sí' : ''} | ${t.exitos}/${t.n} (${pct(t.p)}) | ${pct(t.ic[0])} – ${pct(t.ic[1])} | ${t.conAyuda} | ${t.fallos} | ${num(t.tiempoMedio, 0)} | ${num(t.toquesMedio, 1)} | ${t.errores} |`);
    }
    md.push('', `- **Tareas críticas (${TAREAS_CRITICAS.join(', ')}):** ${r.exitoCriticas.exitos}/${r.exitoCriticas.n} = **${pct(r.exitoCriticas.p)}** (IC 95 % ${pct(r.exitoCriticas.ic[0])} – ${pct(r.exitoCriticas.ic[1])}) → ${r.cumpleExito ? 'cumple' : 'no cumple'} la meta.`);
    md.push(`- **Todas las tareas:** ${r.exitoGlobal.exitos}/${r.exitoGlobal.n} = ${pct(r.exitoGlobal.p)}.`);
  } else md.push('_Sin datos de tareas._');
  md.push('', '_Generado con `npm run piloto:informe`. Fórmulas: SUS de Brooke (1996); IC del éxito por Wald ajustado._', '');
  return md.join('\n');
}

function principal(argv) {
  const valor = (op) => { const i = argv.indexOf(op); return i >= 0 ? argv[i + 1] : null; };
  const rutaSus = valor('--sus');
  const rutaTareas = valor('--tareas');
  if (!rutaSus && !rutaTareas) {
    console.error('Uso: npm run piloto:informe -- --sus sus.csv --tareas tareas.csv [--salida informe.md]');
    process.exit(2);
  }
  const r = analizar({
    sus: rutaSus ? leerCsv(fs.readFileSync(rutaSus, 'utf8')) : [],
    tareas: rutaTareas ? leerCsv(fs.readFileSync(rutaTareas, 'utf8')) : [],
  });
  const md = informeMarkdown(r, { fuente: [rutaSus, rutaTareas].filter(Boolean).join(', ') });
  const salida = valor('--salida');
  if (salida) fs.writeFileSync(salida, md);
  console.log(md);
  process.exitCode = r.veredicto === 'FALLA' ? 1 : 0;
}

if (require.main === module) {
  try { principal(process.argv.slice(2)); } catch (err) { console.error(err.message); process.exit(2); }
}

module.exports = { leerCsv, puntajeSus, estadisticos, adjetivoSus, notaSus, proporcion, analizar, informeMarkdown, TAREAS_CRITICAS };
