/** Protokol adaptorlerinin ortak arayuzu. */

import type { NormalizedRecord, ProtocolName } from '@medentry/shared';

/** Cozumleme sonucunda uretilen mesaj. */
export interface DecodedMessage {
  /** Mesaj turu - is mantigi bunu kullanir. */
  kind: 'login' | 'position' | 'status' | 'alarm' | 'heartbeat' | 'response' | 'media' | 'unknown';
  deviceIdent?: string;
  record?: NormalizedRecord;
  /** Cihaza geri gonderilmesi gereken yanit (ack). */
  ack?: Buffer;
  /** Protokole ozel ek bilgi. */
  meta?: Record<string, unknown>;
}

export interface DecodeResult {
  messages: DecodedMessage[];
  /** Cozulemeyen, bir sonraki veriyle birlestirilecek kuyruk. */
  rest: Buffer;
}

export interface ProtocolDecoder {
  readonly name: ProtocolName;
  /** Varsayilan TCP portu. */
  readonly defaultPort: number;
  /**
   * Akistan gelen veriyi cozer. Eksik paketler `rest` olarak geri doner ve
   * bir sonraki cagrida basa eklenir.
   */
  decode(buffer: Buffer, session: DecoderSession): DecodeResult;
}

/** Baglanti boyunca tasinan durum (login sonrasi cihaz kimligi vb.). */
export interface DecoderSession {
  deviceIdent?: string;
  /** JT808 icin protokol surumu, Teltonika icin codec vb. */
  [key: string]: unknown;
}

export class ProtocolError extends Error {
  constructor(
    message: string,
    readonly protocol: ProtocolName,
    readonly detail?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'ProtocolError';
  }
}
