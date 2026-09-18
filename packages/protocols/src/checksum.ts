/** Protokollerde kullanilan saglama (checksum) fonksiyonlari. */

/**
 * CRC-ITU / CRC-16-X.25 - GT06 ailesi cihazlarda kullanilir.
 * Polinom 0x1021 (ters cevrilmis 0x8408), baslangic 0xFFFF, sonuc tersi.
 */
export function crcItu(data: Buffer): number {
  let crc = 0xffff;
  for (const byte of data) {
    crc ^= byte;
    for (let i = 0; i < 8; i += 1) {
      crc = crc & 1 ? (crc >> 1) ^ 0x8408 : crc >> 1;
    }
  }
  return (~crc & 0xffff) >>> 0;
}

/**
 * CRC-16/ARC (IBM) - Teltonika Codec8 paketlerinde kullanilir.
 * Polinom 0xA001, baslangic 0x0000.
 */
export function crc16Arc(data: Buffer): number {
  let crc = 0x0000;
  for (const byte of data) {
    crc ^= byte;
    for (let i = 0; i < 8; i += 1) {
      crc = crc & 1 ? (crc >> 1) ^ 0xa001 : crc >> 1;
    }
  }
  return crc & 0xffff;
}

/** JT/T 808 XOR saglama baytı. */
export function xorChecksum(data: Buffer): number {
  let sum = 0;
  for (const byte of data) sum ^= byte;
  return sum & 0xff;
}

/** BCD kodlu baytlari rakam dizisine cevirir (or. 0x21 0x09 -> "2109"). */
export function bcdToString(buffer: Buffer): string {
  let out = '';
  for (const byte of buffer) {
    out += ((byte >> 4) & 0x0f).toString(16);
    out += (byte & 0x0f).toString(16);
  }
  return out;
}

/** Rakam dizisini BCD baytlara cevirir; gerekirse basa sifir eklenir. */
export function stringToBcd(value: string, byteLength: number): Buffer {
  const padded = value.padStart(byteLength * 2, '0').slice(-byteLength * 2);
  const out = Buffer.alloc(byteLength);
  for (let i = 0; i < byteLength; i += 1) {
    const hi = Number.parseInt(padded[i * 2] ?? '0', 16);
    const lo = Number.parseInt(padded[i * 2 + 1] ?? '0', 16);
    out[i] = ((hi << 4) | lo) & 0xff;
  }
  return out;
}
