import type { PlainHeader } from './types';

export const BLOB_VERSION = 0x01;
export const IV_BYTES = 12;

/** [헤더 길이 4B big-endian][헤더 JSON UTF-8][내용] */
export function encodePlain(header: PlainHeader, content: Uint8Array): Uint8Array {
  throw new Error('TODO(보안): encodePlain');
}

export function decodePlain(plain: Uint8Array): { header: PlainHeader; content: Uint8Array } {
  throw new Error('TODO(보안): decodePlain');
}

/** [버전 1B][IV 12B][암호문+태그] */
export function packBlob(iv: Uint8Array, ciphertext: Uint8Array): Uint8Array {
  throw new Error('TODO(보안): packBlob');
}

export function unpackBlob(blob: Uint8Array): { iv: Uint8Array; ciphertext: Uint8Array } {
  throw new Error('TODO(보안): unpackBlob');
}
