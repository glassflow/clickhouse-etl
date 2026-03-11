declare module 'lz4js' {
  export function decompress(src: Uint8Array | number[], maxSize?: number): Uint8Array
}
