// A browser scene's readback of a WebGL context's drawing buffer, as WebGL reads it: the whole buffer as RGBA bytes,
// bottom row first, or the colour of one pixel.
/** A pixel of the readback: four bytes, red, green, blue and alpha, the first three its colour. */
export const FRAME_PIXEL = Object.freeze({stride: 4, colorChannels: 3});

export function readFramePixels(gl: WebGLRenderingContext | WebGL2RenderingContext): Uint8Array {
  const {drawingBufferWidth: width, drawingBufferHeight: height} = gl;
  const pixels = new Uint8Array(width * height * FRAME_PIXEL.stride);
  gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
  return pixels;
}
/** A pixel's colour bytes: red, green and blue. */
export type RgbBytes = readonly [number, number, number];
/** The colour of the pixel at a fraction of the buffer's width and height, from its bottom-left corner. */
export function readPixelColor(gl: WebGLRenderingContext | WebGL2RenderingContext,
  [fx, fy]: readonly [number, number]): RgbBytes {
  const pixel = new Uint8Array(FRAME_PIXEL.stride);
  gl.readPixels(Math.floor(gl.drawingBufferWidth * fx), Math.floor(gl.drawingBufferHeight * fy), 1, 1, gl.RGBA,
    gl.UNSIGNED_BYTE, pixel);
  return [pixel[0], pixel[1], pixel[2]];
}
