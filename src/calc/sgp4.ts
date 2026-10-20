/**
 * La partie JavaScript de satellite.js (SGP4, temps sidéral, ECI → ECF), sans son module WASM : depuis la
 * version 7, le point d'entrée du paquet réexporte aussi des calculateurs WASM multi-fils que Vite ne sait pas
 * empaqueter (await de premier niveau dans un worker) et dont Coupole Web n'a pas besoin.  Les chemins relatifs
 * contournent le champ « exports » du paquet, qui n'expose que ce point d'entrée.
 */
export { twoline2satrec } from '../../node_modules/satellite.js/dist/io.js';
export { propagate, gstime } from '../../node_modules/satellite.js/dist/propagation.js';
export { eciToEcf } from '../../node_modules/satellite.js/dist/transforms.js';
