/** R2 접근. 키 형식: blobs/{id} */

export function blobKey(id: string): string {
  return `blobs/${id}`;
}

export async function putBlob(bucket: R2Bucket, id: string, body: ArrayBuffer): Promise<void> {
  throw new Error('TODO(BE): putBlob');
}

export async function getBlob(bucket: R2Bucket, id: string): Promise<ArrayBuffer | null> {
  throw new Error('TODO(BE): getBlob');
}

export async function deleteBlob(bucket: R2Bucket, id: string): Promise<void> {
  throw new Error('TODO(BE): deleteBlob');
}
