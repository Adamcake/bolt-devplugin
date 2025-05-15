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
  texSize?: GLfloat;
  vertices?: Vertex[];
  models?: Model[];
  sourcex?: number;
  sourcey?: number;
  sourcew?: number;
  sourceh?: number;
  targetx?: number;
  targety?: number;
  targetw?: number;
  targeth?: number;
  enabled: boolean;
  expanded: boolean;
  uuid: string;
  enabledVerticesList?: boolean[];
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

export interface MenuData {
  entities: Entity[];
  textures: Record<number, Texture>;
  selectedTexture: Texture | null;
  selectedTextureId: string;
  redraw: () => void;
}

export interface Point3D {
  x: GLfloat;
  y: GLfloat;
  z: GLfloat;
}

export interface ImageData2D {
  x: GLfloat;
  y: GLfloat;
  w: GLfloat;
  h: GLfloat;
  ax: GLfloat;
  ay: GLfloat;
  aw: GLfloat;
  ah: GLfloat;
  r: GLfloat;
  g: GLfloat;
  b: GLfloat;
  a: GLfloat;
  expanded: boolean;
  index: number;
}

export interface VertexData3D {
  modelpoint: Point3D | null;
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
  expanded: boolean;
  index: number;
}

export interface ModelVertexData {
  modelpoint: Point3D;
  r: GLfloat;
  g: GLfloat;
  b: GLfloat;
  a: GLfloat;
  expanded: boolean;
  index: number;
}
