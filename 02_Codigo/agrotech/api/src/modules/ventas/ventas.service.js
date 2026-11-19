'use strict';

const { errores } = require('../../utils/http-error');

const ZONA = 'America/Bogota';
const DIA_MS = 864e5;
const MAX_DIAS = 366;
const PERIODOS = {
  semana: 'Últimos 7 días',
  mes: 'Este mes',
  mes_anterior: 'Mes pasado',
  anio: 'Este año',
};

// Colombia no tiene horario de verano: UTC−5 todo el año.
const hoyBogota = (ahora = Date.now()) => new Date(ahora - 5 * 3600e3).toISOString().slice(0, 10);
const sumarDias = (iso, n) => new Date(Date.parse(`${iso}T00:00:00Z`) + n * DIA_MS).toISOString().slice(0, 10);
const diasEntre = (a, b) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / DIA_MS);
function fechaValida(v) {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const t = Date.parse(`${v}T00:00:00Z`);
  return !Number.isNaN(t) && new Date(t).toISOString().startsWith(v); // descarta 2026-02-30
}

/**
 * Resuelve el periodo pedido. CU-07 A3: un rango inválido se corrige y se informa (no se rechaza):
 * fechas invertidas se intercambian, el futuro se recorta a hoy y más de un año se limita a 366 días.
 */
function resolverPeriodo(query = {}, ahora = Date.now()) {
  const hoy = hoyBogota(ahora);
  const [anio, mes] = hoy.split('-');
  if (query.desde !== undefined || query.hasta !== undefined) {
    if (!fechaValida(query.desde) || !fechaValida(query.hasta)) {
      throw errores.datosInvalidos('Use fechas AAAA-MM-DD en "desde" y "hasta".', { campos: { desde: 'AAAA-MM-DD', hasta: 'AAAA-MM-DD' } });
    }
    let { desde, hasta } = query;
    const correcciones = [];
    if (desde > hasta) { [desde, hasta] = [hasta, desde]; correcciones.push('las fechas estaban invertidas'); }
    if (hasta > hoy) { hasta = hoy; correcciones.push('no hay ventas futuras: se usó hasta hoy'); }
    if (desde > hoy) desde = hoy;
    if (diasEntre(desde, hasta) + 1 > MAX_DIAS) { desde = sumarDias(hasta, -(MAX_DIAS - 1)); correcciones.push('el máximo es un año'); }
    return { codigo: 'personalizado', nombre: 'Personalizado', desde, hasta, correccion: correcciones.length ? `Se ajustó el rango: ${correcciones.join('; ')}.` : null };
  }
  const codigo = query.periodo || 'mes';
  // Object.hasOwn: "constructor", "toString"… existen en el prototipo y no son periodos válidos.
  if (typeof codigo !== 'string' || !Object.hasOwn(PERIODOS, codigo)) throw errores.datosInvalidos(`Periodo inválido. Use: ${Object.keys(PERIODOS).join(', ')}.`);
  let desde = `${anio}-${mes}-01`;
  let hasta = hoy;
  if (codigo === 'semana') desde = sumarDias(hoy, -6);
  if (codigo === 'anio') desde = `${anio}-01-01`;
  if (codigo === 'mes_anterior') {
    hasta = sumarDias(`${anio}-${mes}-01`, -1);
    desde = `${hasta.slice(0, 7)}-01`;
  }
  return { codigo, nombre: PERIODOS[codigo], desde, hasta, correccion: null };
}

/**
 * CU-07 · Panel de ventas (RF-07). Una venta cuenta el día en que el pedido pasó a ENTREGADO
 * (hora de Colombia) y por el total pactado. CA-11: las cifras coinciden con los pedidos entregados.
 */
function createVentasService({ pool, ahora = () => Date.now() }) {
  const ENTREGAS = `
    SELECT p.id_pedido, p.total, (h.fecha AT TIME ZONE '${ZONA}')::date AS dia
    FROM pedido p
    JOIN historial_estado h ON h.id_pedido = p.id_pedido AND h.estado_nuevo = 'ENTREGADO'
    WHERE p.id_productor = $1 AND p.estado = 'ENTREGADO'
      AND h.fecha >= ($2::date)::timestamp AT TIME ZONE '${ZONA}'
      AND h.fecha <  ($3::date + 1)::timestamp AT TIME ZONE '${ZONA}'`;

  return {
    async resumen({ usuario, query }) {
      const periodo = resolverPeriodo(query, ahora());
      const params = [usuario.id, periodo.desde, periodo.hasta];
      const [porDia, top, curso] = await Promise.all([
        pool.query(`WITH e AS (${ENTREGAS}) SELECT to_char(dia, 'YYYY-MM-DD') AS dia, count(*)::int AS pedidos, sum(total) AS ingresos FROM e GROUP BY dia ORDER BY dia`, params),
        pool.query(
          `WITH e AS (${ENTREGAS})
           SELECT d.id_producto, pr.nombre, pr.unidad_medida, sum(d.cantidad) AS cantidad, sum(d.subtotal) AS ingresos, count(DISTINCT d.id_pedido)::int AS pedidos
           FROM e JOIN detalle_pedido d ON d.id_pedido = e.id_pedido JOIN producto pr ON pr.id_producto = d.id_producto
           GROUP BY d.id_producto, pr.nombre, pr.unidad_medida
           ORDER BY sum(d.subtotal) DESC, pr.nombre LIMIT 5`,
          params,
        ),
        pool.query(
          `SELECT count(*)::int AS pedidos, COALESCE(sum(total), 0) AS valor FROM pedido
           WHERE id_productor = $1 AND estado IN ('PENDIENTE', 'ACEPTADO', 'EN_CAMINO')`,
          [usuario.id],
        ),
      ]);

      const dias = new Map(porDia.rows.map((r) => [r.dia, { pedidos: r.pedidos, ingresos: Number(r.ingresos) }]));
      const pedidos = porDia.rows.reduce((s, r) => s + r.pedidos, 0);
      const ingresos = porDia.rows.reduce((s, r) => s + Number(r.ingresos), 0);

      // Serie para el gráfico: por día hasta 62 días; por mes en rangos más largos.
      const n = diasEntre(periodo.desde, periodo.hasta) + 1;
      const serie = [];
      if (n <= 62) {
        for (let i = 0; i < n; i += 1) {
          const fecha = sumarDias(periodo.desde, i);
          serie.push({ fecha, ...(dias.get(fecha) || { pedidos: 0, ingresos: 0 }) });
        }
      } else {
        const meses = new Map();
        for (let i = 0; i < n; i += 1) {
          const f = sumarDias(periodo.desde, i);
          const m = meses.get(f.slice(0, 7)) || { fecha: f.slice(0, 7), pedidos: 0, ingresos: 0 };
          const d = dias.get(f);
          if (d) { m.pedidos += d.pedidos; m.ingresos += d.ingresos; }
          meses.set(f.slice(0, 7), m);
        }
        serie.push(...meses.values());
      }

      return {
        periodo: { codigo: periodo.codigo, nombre: periodo.nombre, desde: periodo.desde, hasta: periodo.hasta, agrupacion: n <= 62 ? 'dia' : 'mes' },
        correccion: periodo.correccion,
        resumen: { pedidosEntregados: pedidos, ingresos, ticketPromedio: pedidos ? Math.round(ingresos / pedidos) : 0 },
        serie,
        topProductos: top.rows.map((r) => ({
          idProducto: r.id_producto, nombre: r.nombre, unidad: r.unidad_medida,
          cantidad: Number(r.cantidad), ingresos: Number(r.ingresos), pedidos: r.pedidos,
        })),
        enCurso: { pedidos: curso.rows[0].pedidos, valor: Number(curso.rows[0].valor) },
        generadoEn: new Date(ahora()).toISOString(),
      };
    },
  };
}

module.exports = { createVentasService, resolverPeriodo, hoyBogota };
