import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

/**
 * Generador de imágenes PNG nativo sin dependencias externas
 */
function createPNG(width, height, getPixel) {
  // getPixel(x, y) => [r, g, b, a]
  const rawData = Buffer.alloc(height * (1 + width * 4));
  let offset = 0;

  for (let y = 0; y < height; y++) {
    rawData[offset++] = 0; // Filter type: None
    for (let x = 0; x < width; x++) {
      const [r, g, b, a] = getPixel(x, y);
      rawData[offset++] = r;
      rawData[offset++] = g;
      rawData[offset++] = b;
      rawData[offset++] = a !== undefined ? a : 255;
    }
  }

  const compressed = zlib.deflateSync(rawData);

  // PNG Signature
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR chunk
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // Bit depth
  ihdr[9] = 6; // Color type: RGBA
  ihdr[10] = 0; // Compression
  ihdr[11] = 0; // Filter
  ihdr[12] = 0; // Interlace

  const ihdrChunk = createChunk('IHDR', ihdr);
  const idatChunk = createChunk('IDAT', compressed);
  const iendChunk = createChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

function createChunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);

  const typeBuf = Buffer.from(type, 'ascii');
  const typeAndData = Buffer.concat([typeBuf, data]);

  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(typeAndData), 0);

  return Buffer.concat([length, typeAndData, crcBuf]);
}

function crc32(buf) {
  let crc = -1;
  for (let i = 0; i < buf.length; i++) {
    crc = (crc >>> 8) ^ crcTable[(crc ^ buf[i]) & 0xff];
  }
  return (crc ^ -1) >>> 0;
}

const crcTable = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  crcTable[n] = c;
}

// -------------------------------------------------------------
// DEFINICIÓN DE TEXTURAS DE PIXEL ART DE MINECRAFT
// -------------------------------------------------------------

export function generateCapePNG(theme) {
  return createPNG(64, 32, (x, y) => {
    // Región frontal de la capa (1..10, 1..16) y trasera (12..21, 1..16)
    const isFront = x >= 1 && x <= 10 && y >= 1 && y <= 16;
    const isBack = x >= 12 && x <= 21 && y >= 1 && y <= 16;

    if (theme === 'rafa-champions') {
      // Fondo esmeralda con R dorada y ribetes de oro
      if (isBack || isFront) {
        if (x === 1 || x === 10 || x === 12 || x === 21 || y === 1 || y === 16) {
          return [218, 165, 32, 255]; // Oro
        }
        // Letra R en el centro de la espalda
        if (isBack && y >= 5 && y <= 12) {
          if (x === 14 || (y === 5 && x <= 18) || (y === 8 && x <= 18) || (x === 18 && y >= 5 && y <= 8) || (x === 16 && y === 9) || (x === 17 && y === 10) || (x === 18 && y >= 11)) {
            return [255, 215, 0, 255]; // Oro brillante
          }
        }
        // Fondo esmeralda con matiz
        const green = (x + y) % 2 === 0 ? 150 : 130;
        return [16, green, 80, 255];
      }
      return [10, 100, 50, 255];
    }

    if (theme === 'rafa-vip-gold') {
      // Negro obsidiana con alas doradas
      if (isBack || isFront) {
        if (x === 1 || x === 10 || x === 12 || x === 21 || y === 1 || y === 16) {
          return [255, 215, 0, 255];
        }
        // Corona/Alas VIP en el centro
        if (isBack && y >= 6 && y <= 11 && x >= 14 && x <= 19) {
          return [255, 225, 50, 255];
        }
        const shade = (x * 7 + y * 13) % 15;
        return [20 + shade, 20 + shade, 25 + shade, 255];
      }
      return [15, 15, 20, 255];
    }

    if (theme === 'rafa-matrix') {
      // Negro con lluvia de código matrix verde
      if ((x * 3 + y * 7) % 5 === 0) {
        return [50, 255, 120, 255];
      }
      if ((x + y) % 3 === 0) {
        return [20, 180, 60, 255];
      }
      return [5, 15, 8, 255];
    }

    if (theme === 'dragon-flame') {
      // Fuego del Nether / Dragón
      if (isBack && y >= 6 && y <= 11 && x >= 14 && x <= 19) {
        return [255, 50, 0, 255]; // Ojos / Emblema rojo fuego
      }
      const flame = Math.floor((y / 16) * 200);
      return [200 - flame, Math.max(0, 80 - flame), 10, 255];
    }

    if (theme === 'galaxy-nebula') {
      // Galaxia violeta y azul con estrellas
      if ((x * 11 + y * 17) % 19 === 0) {
        return [255, 255, 255, 255]; // Estrellas
      }
      const r = Math.floor((x / 64) * 120 + 40);
      const b = Math.floor((y / 32) * 180 + 75);
      return [r, 20, b, 255];
    }

    if (theme === 'ice-glacier') {
      // Hielo Glaciar Ártico
      if ((x + y) % 4 === 0) return [255, 255, 255, 255];
      const cyan = 180 + ((x * y) % 50);
      return [100, cyan, 255, 255];
    }

    if (theme === 'anime-akatsuki') {
      // Akatsuki Nube Roja sobre Negro
      if (isBack) {
        // Nube roja
        if ((y >= 6 && y <= 11 && x >= 14 && x <= 19) || (y === 8 && x >= 13 && x <= 20)) {
          if (x === 13 || x === 20 || y === 6 || y === 11) {
            return [255, 255, 255, 255]; // Borde blanco
          }
          return [220, 20, 20, 255]; // Interior rojo
        }
      }
      return [18, 18, 22, 255];
    }

    if (theme === 'anime-demon-slayer') {
      // Cuadros verdes y negros de Tanjirou
      const grid = (Math.floor(x / 3) + Math.floor(y / 3)) % 2;
      return grid === 0 ? [20, 160, 90, 255] : [15, 15, 15, 255];
    }

    // Default elegante
    return [30, 30, 40, 255];
  });
}

export function generateTextureBase64(theme) {
  const buf = generateCapePNG(theme);
  return `data:image/png;base64,${buf.toString('base64')}`;
}
