'use strict';

const {
  leerCsv, puntajeSus, estadisticos, adjetivoSus, notaSus, proporcion, analizar, informeMarkdown,
} = require('../../scripts/informe-piloto');

describe('Informe del piloto · CP-12 (SUS y éxito en tareas)', () => {
  test.each([
    [[3, 3, 3, 3, 3, 3, 3, 3, 3, 3], 50],
    [[5, 1, 5, 1, 5, 1, 5, 1, 5, 1], 100],
    [[1, 5, 1, 5, 1, 5, 1, 5, 1, 5], 0],
    [[4, 2, 4, 2, 4, 2, 4, 2, 4, 2], 75],
    [[5, 2, 4, 1, 4, 2, 5, 1, 4, 3], 82.5],
  ])('SUS de %j = %d', (respuestas, esperado) => {
    expect(puntajeSus(respuestas)).toBe(esperado);
  });

  test('rechaza respuestas fuera de 1–5 o incompletas', () => {
    expect(() => puntajeSus([3, 3, 3, 3, 3, 3, 3, 3, 3, 6])).toThrow('pregunta 10');
    expect(() => puntajeSus([3, 3, 3])).toThrow('10 preguntas');
  });

  test('media, desviación e IC 95 % con t de Student', () => {
    const e = estadisticos([70, 75, 80, 85, 90]);
    expect(e.media).toBe(80);
    expect(e.de).toBeCloseTo(7.906, 3);
    expect(e.ic[0]).toBeCloseTo(70.18, 1); // 80 − 2,776 × 7,906 / √5
    expect(e.ic[1]).toBeCloseTo(89.82, 1);
  });

  test('adjetivos (Bangor) y notas (Sauro y Lewis)', () => {
    expect([adjetivoSus(90), adjetivoSus(72), adjetivoSus(68), adjetivoSus(40), adjetivoSus(20)]).toEqual(['Excelente', 'Bueno', 'Aceptable', 'Pobre', 'Pésimo']);
    expect([notaSus(85), notaSus(68), notaSus(50)]).toEqual(['A+', 'C', 'F']);
  });

  test('éxito 4 de 5 con IC de Wald ajustado ≈ 36 %–98 %', () => {
    const p = proporcion(4, 5);
    expect(p.p).toBe(0.8);
    expect(p.ic[0]).toBeCloseTo(0.36, 2);
    expect(p.ic[1]).toBeCloseTo(0.98, 2);
  });

  test('lee CSV con punto y coma (Excel en español) e ignora comentarios', () => {
    const filas = leerCsv('\uFEFFparticipante;rol;p1\n# comentario\nP01;PRODUCTOR;4\n');
    expect(filas).toEqual([{ participante: 'P01', rol: 'PRODUCTOR', p1: '4', _linea: 3 }]);
  });

  test('veredicto CP-12: PASA con SUS ≥ 68 y ≥ 80 % de éxito en tareas críticas; FALLA si no', () => {
    const sus = leerCsv(['participante,rol,p1,p2,p3,p4,p5,p6,p7,p8,p9,p10',
      'P01,PRODUCTOR,4,2,4,2,4,2,4,2,4,2', 'P02,CONSUMIDOR,5,1,4,2,5,1,4,2,4,2'].join('\n'));
    const tareas = (resultadoP2) => leerCsv(['participante,rol,tarea,resultado,tiempo_s,errores,toques',
      `P01,PRODUCTOR,P2,${resultadoP2},95,0,3`, 'P02,CONSUMIDOR,C3,EXITO,80,1,3', 'P01,PRODUCTOR,P1,AYUDA,200,2,'].join('\n'));
    const ok = analizar({ sus, tareas: tareas('EXITO') });
    expect(ok).toMatchObject({ veredicto: 'PASA', cumpleSus: true, cumpleExito: true });
    expect(ok.porTarea.find((t) => t.tarea === 'P1')).toMatchObject({ exitos: 0, conAyuda: 1, critica: false });
    const mal = analizar({ sus, tareas: tareas('AYUDA') }); // con ayuda no cuenta como éxito
    expect(mal).toMatchObject({ veredicto: 'FALLA', cumpleExito: false });
    expect(informeMarkdown(mal)).toContain('**FALLA**');
    expect(analizar({ sus, tareas: [] }).veredicto).toBe('INCOMPLETO');
  });

  test('indica la línea del CSV con datos inválidos', () => {
    const tareas = leerCsv('participante,rol,tarea,resultado\nP01,PRODUCTOR,P2,BIEN');
    expect(() => analizar({ tareas })).toThrow('tareas.csv línea 2');
  });
});
