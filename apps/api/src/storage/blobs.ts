/** R2 접근. 키 형식: blobs/{id} */

export function blobKey(id: string): string {
  return `blobs/${id}`;
}

export async function putBlob(bucket: R2Bucket, id: string, body: ArrayBuffer): Promise<boolean> {
  const object = await bucket.put(blobKey(id), body, { onlyIf: { etagDoesNotMatch: '*' } });
  return object !== null;
}

export async function getBlob(bucket: R2Bucket, id: string): Promise<ArrayBuffer | null> {
  const object = await bucket.get(blobKey(id));
  return object ? object.arrayBuffer() : null;
}

export async function deleteBlobs(bucket: R2Bucket, ids: string[]): Promise<void> {
  await bucket.delete(ids.map(blobKey));
}
