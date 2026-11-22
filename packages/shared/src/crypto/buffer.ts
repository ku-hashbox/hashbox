/**
 * WebCrypto 타입 정의(TS 5.7+)는 ArrayBuffer 기반 뷰만 받는다.
 * 이 모듈의 바이트는 모두 일반 ArrayBuffer라서 타입만 좁혀준다.
 */
export function bytes(u: Uint8Array): Uint8Array<ArrayBuffer> {
  return u as Uint8Array<ArrayBuffer>;
}
