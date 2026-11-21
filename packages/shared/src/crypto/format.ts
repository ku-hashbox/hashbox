import { MAX_HEADER_BYTES } from '../constants';
import { DecryptError, InvalidInputError } from './errors';
import type { PlainHeader } from './types';

export const BLOB_VERSION = 0x01;
export const IV_BYTES = 12;
export const TAG_BYTES = 16;
const HEADER_LEN_BYTES = 4;
const KINDS = new Set(['text', 'env', 'file']);

const utf8Encoder = new TextEncoder();
const utf8Decoder = new TextDecoder('utf-8', { fatal: true, ignoreBOM: false });

/** [헤더 길이 4B big-endian][헤더 JSON UTF-8][내용] */
export function encodePlain(header: PlainHeader, content: Uint8Array): Uint8Array {
  const headerBytes = utf8Encoder.encode(JSON.stringify(header));
  if (headerBytes.length > MAX_HEADER_BYTES) {
    throw new InvalidInputError(`header too large: ${headerBytes.length}B`);
  }
  const out = new Uint8Array(HEADER_LEN_BYTES + headerBytes.length + content.length);
  new DataView(out.buffer).setUint32(0, headerBytes.length, false);
  out.set(headerBytes, HEADER_LEN_BYTES);
  out.set(content, HEADER_LEN_BYTES + headerBytes.length);
  return out;
}

/** 복호화된 평문을 헤더와 내용으로 나눈다. 형식이 깨졌으면 DecryptError */
export function decodePlain(plain: Uint8Array): { header: PlainHeader; content: Uint8Array } {
  if (plain.length < HEADER_LEN_BYTES) throw new DecryptError('plaintext too short');
  const view = new DataView(plain.buffer, plain.byteOffset, plain.byteLength);
  const headerLen = view.getUint32(0, false);
  if (headerLen > MAX_HEADER_BYTES || HEADER_LEN_BYTES + headerLen > plain.length) {
    throw new DecryptError('bad header length');
  }

  let header: unknown;
  try {
    const json = utf8Decoder.decode(plain.subarray(HEADER_LEN_BYTES, HEADER_LEN_BYTES + headerLen));
    header = JSON.parse(json);
  } catch {
    throw new DecryptError('bad header json');
  }
  if (!isPlainHeader(header)) throw new DecryptError('unsupported header');

  return { header, content: plain.slice(HEADER_LEN_BYTES + headerLen) };
}

function isPlainHeader(h: unknown): h is PlainHeader {
  if (typeof h !== 'object' || h === null) return false;
  const o = h as Record<string, unknown>;
  if (o.v !== 1 || typeof o.kind !== 'string' || !KINDS.has(o.kind)) return false;
  if (o.name !== undefined && typeof o.name !== 'string') return false;
  if (o.mime !== undefined && typeof o.mime !== 'string') return false;
  if (o.size !== undefined && typeof o.size !== 'number') return false;
  return true;
}

/** [버전 1B][IV 12B][암호문+태그] */
export function packBlob(iv: Uint8Array, ciphertext: Uint8Array): Uint8Array {
  if (iv.length !== IV_BYTES) throw new InvalidInputError('iv must be 12 bytes');
  if (ciphertext.length < TAG_BYTES) throw new InvalidInputError('ciphertext too short');
  const out = new Uint8Array(1 + IV_BYTES + ciphertext.length);
  out[0] = BLOB_VERSION;
  out.set(iv, 1);
  out.set(ciphertext, 1 + IV_BYTES);
  return out;
}

/** 저장 포맷을 푼다. 버전이 다르거나 너무 짧으면 DecryptError */
export function unpackBlob(blob: Uint8Array): { iv: Uint8Array; ciphertext: Uint8Array } {
  if (blob.length < 1 + IV_BYTES + TAG_BYTES) throw new DecryptError('blob too short');
  if (blob[0] !== BLOB_VERSION) throw new DecryptError(`unsupported blob version: ${blob[0]}`);
  return {
    iv: blob.slice(1, 1 + IV_BYTES),
    ciphertext: blob.slice(1 + IV_BYTES),
  };
}
