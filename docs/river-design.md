# Aguas Arriba — Diseño del ecosistema fluvial

Fecha: 2026-11-26. Estado: dirección de diseño acordada; modelo hidráulico experimental, no calibrado.

## Objetivo
Simulador didáctico de pesca con mosca, dinámica fluvial y ecología, ejecutable en navegador móvil y escritorio. La física determina el movimiento de agua, peces, insectos y mosca; el render ASCII es independiente. Conservar el simulador de lance y la estética aprobada de ASCII River Lab 0.2.

## Fundamentos
- Velocidad variable con profundidad, rugosidad del lecho y distancia a márgenes; el máximo puede estar bajo la superficie.
- Rocas tridimensionales: estancamiento aguas arriba, aceleración lateral, flujo sobre obstáculos sumergidos, estelas, recirculación y turbulencia.
- Geomorfología: rápidos someros (riffles), corridas (runs), pozones (pools), escalones y cascadas; batimetría, ancho, pendiente, curvas y circulación secundaria helicoidal.
- Truchas: reotaxis, refugio energético, disponibilidad de alimento y costo de persecución. El refugio no siempre maximiza la ganancia energética. Los resultados experimentales de 25–50 cm/s no son umbrales universales.
- Moscas e insectos: deriva, flotabilidad, hundimiento, resistencia relativa al agua. Temperatura, oxígeno, turbidez, vegetación y eclosiones son extensiones futuras.

## Decisiones
1. Modelo inicial procedural 2.5D con consulta tridimensional continua velocityAt(x,y,z,time). No resolver Navier–Stokes inicialmente; no afirmar conservación de masa ni exactitud hidráulica sin validación.
2. Un único campo de velocidades para todos los agentes. Separar geometría, hidráulica, ecología, pesca y renderizado.
3. Coordenadas: x longitudinal, y vertical positiva hacia arriba, z transversal; unidades de referencia metros y segundos. Superficie y lecho explícitos.
4. Mantener ASCII 0.2 como referencia visual; añadir vista técnica opcional. No alterar física del lance.
5. Escenarios reproducibles mediante semillas, pruebas automatizadas, control de rendimiento móvil. Calibración futura con mediciones reales, eventualmente arroyos serranos de San Luis.
6. Las ecuaciones de aguas someras promedian en profundidad; considerar un solucionador posterior con reconstrucción vertical. CFD 3D queda fuera del alcance inicial.

## Hoja de ruta
- 0.3: campo de velocidades, gradientes verticales, márgenes, obstáculos, estelas y trazadores; visualización opcional.
- 0.4: geometría procedural del cauce, batimetría, curvas, rápidos, pozones y semillas.
- 0.5: decisiones de peces mediante balance energético, alimento, refugios y competencia.
- 0.6: moscas secas, ninfas, streamers, deriva y detección.
- 0.7: integración con lance, línea y tensión.
- Posterior: temperatura, oxígeno, turbidez, vegetación, caudal temporal; erosión de baja prioridad.

## Referencias de investigación previa
- USDA, Stream Corridor Processes and Characteristics: https://directives.nrcs.usda.gov/sites/default/files2/1720534527/Chapter%202%20-%20Stream%20Corridor%20Processes%20and%20Characteristics.pdf
- NPS, Fluvial geomorphology: https://www.nps.gov/articles/fluvial-geomorphology-monitoring-stream-systems-in-response-to-a-changing-environment.htm
- HEC-RAS, Shallow Water Equations: https://www.hec.usace.army.mil/confluence/hecras/beta/technical-reference/hydraulic-equations/shallow-water-equations
- Oxygen consumption of drift-feeding rainbow trout: https://pmc.ncbi.nlm.nih.gov/articles/PMC7328162/
- Individual-based Trout Model Formulation: https://esapubs.org/Archive/ecol/E083/031/FormDoc.htm
- Inspiración gráfica ASCII Lab: https://github.com/sapozhkov/ascii-lab-public

Estas referencias provienen de la investigación de diseño previa; no se han reabierto en esta sesión. Los coeficientes procedurales son hipótesis de implementación, no valores calibrados.

## Implementación 0.4
- `public/river-geometry.js`: perfiles serrano, rapidos, pozon, curva y estrecho; centro, semiancho y batimetría procedural. Semilla inicial 42; regenerar incrementa semilla. Geometría y piedras reproducibles, no toda la simulación.
- Hidráulica: perfil vertical local, fricción lateral, factor de velocidad aproximado inverso a sección local y dirección tangente al eje. No es un solucionador de continuidad ni reproduce circulación helicoidal todavía.
- Vista ASCII: zoom, lecho, superficie y margen posterior; mosca libre por defecto, línea ilustrativa en modo manual. No hay aún física de línea.
- Pendientes: ejecutar pruebas, verificar despliegue y legibilidad móvil, mejorar colisiones con sólidos y validar perfiles. Ecología energética queda para 0.5.
