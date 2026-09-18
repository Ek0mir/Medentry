export * from './types.js';
export * from './checksum.js';
export * from './gt06.js';
export * from './teltonika.js';
export * from './jt808.js';
export * from './generic.js';
export * from './encoders.js';

import type { ProtocolName } from '@medentry/shared';
import { gt06 } from './gt06.js';
import { teltonika } from './teltonika.js';
import { jt808 } from './jt808.js';
import type { ProtocolDecoder } from './types.js';

/** Ingest sunucusunun kullandigi protokol kayit defteri. */
export const DECODERS: Partial<Record<ProtocolName, ProtocolDecoder>> = {
  gt06,
  teltonika,
  jt808,
};

export function getDecoder(name: ProtocolName): ProtocolDecoder {
  const decoder = DECODERS[name];
  if (!decoder) throw new Error(`Desteklenmeyen protokol: ${name}`);
  return decoder;
}
