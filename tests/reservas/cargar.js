// Carga los .gs en un mismo contexto vm, como si fueran un solo proyecto de Apps Script.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const raiz = path.join(__dirname, '..', '..');

function cargar(...rutas) {
  const contexto = vm.createContext({ console, URL });
  for (const ruta of rutas) {
    vm.runInContext(fs.readFileSync(path.join(raiz, ruta), 'utf8'), contexto, { filename: ruta });
  }
  return contexto;
}

const ms = (iso) => Date.parse(iso);

// Sábado 17-oct-2026, 12:00 en Bogotá.
const ahora = ms('2026-10-17T17:00:00Z');

function base(sobrescribir) {
  return Object.assign({
    codigo: 'UF-ABC234',
    creada: '2026-10-17T17:00:00Z',
    sede: 'ELCARMEN',
    espacio: 'MESA',
    fecha: '2026-10-22',
    hora: '20:00',
    personas: 4,
    nombre: 'Laura Gómez',
    tipo_doc: 'CC',
    documento: '1234567890',
    correo: 'laura@example.com',
    celular: '3001234567',
    comentario: 'Cumpleaños',
    estado: 'CONFIRMADA',
    bold_link: 'LNK_TEST123',
    bold_url: 'https://checkout.bold.co/payment/LNK_TEST123',
    vence: '',
    pagada_en: '2026-10-17T17:05:00Z',
    token_cancelar: 'tok123',
    devolucion: 'NO',
    descuento_aplicado: false,
    marcada_en: '',
    notas: 'Sin notas',
    adelanto: 50000
  }, sobrescribir);
}

module.exports = { cargar, ms, ahora, base };
