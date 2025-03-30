export interface Entity {
  type: string;
  textureId?: number;
  targetWidth?: GLfloat;
  targetHeight?: GLfloat;
  animated?: boolean;
  buffer?: Buffer;
  vertexCount?: number;
  texture?: WebGLTexture;
  modelMatrix?: Float32Array;
  viewMatrix?: Float32Array;
  texSize?: GLfloat;
  vertices?: Vertex[];
  models?: Model[];
  vbo?: WebGLBuffer;
  sourcex?: number;
  sourcey?: number;
  sourcew?: number;
  sourceh?: number;
  targetx?: number;
  targety?: number;
  targetw?: number;
  targeth?: number;
  enabled: boolean;
}

export interface Texture {
  width: GLfloat;
  height: GLfloat;
  texture: WebGLTexture;
  data: Uint8Array;
}

export interface Buffer {
  vbo: WebGLBuffer;
  attribs: Attribute[];
  step: number;
}

export interface Attribute {
  count: number;
  offset: number;
}

export interface Vertex {
  x: GLfloat;
  y: GLfloat;
  z: GLfloat;
  u: GLfloat;
  v: GLfloat;
  ax: GLfloat;
  ay: GLfloat;
  aw: GLfloat;
  ah: GLfloat;
  r: GLfloat;
  g: GLfloat;
  b: GLfloat;
  a: GLfloat;
  anim: Float32Array | null;
}

export interface Model {
  vertices: Vertex[];
  modelMatrix: Float32Array;
  viewMatrix: Float32Array;
  projMatrix: Float32Array;
}
