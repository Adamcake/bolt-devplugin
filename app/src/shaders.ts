import { type Attribute } from "./interfaces";

export const vertexShaderSource2d = `#version 300 es
layout (location = 0) in highp vec4 xy_uv;
layout (location = 1) in highp vec4 in_image_xywh;
layout (location = 2) in highp vec4 in_rgba;
layout (location = 3) in lowp vec3 in_discard_wrapx_wrapy;
out highp vec4 rgba;
out highp vec2 uv;
out highp vec4 image_xywh;
out lowp vec3 discard_wrapx_wrapy;
uniform highp vec4 atlas_wh_screen_wh;
void main() {
    rgba = in_rgba;
    uv = xy_uv.pq;
    image_xywh = in_image_xywh;
    discard_wrapx_wrapy = in_discard_wrapx_wrapy;
    gl_Position = vec4(
        (xy_uv.x * 2.0 / atlas_wh_screen_wh.p) - 1.0,
        1.0 - (xy_uv.y * 2.0 / atlas_wh_screen_wh.q),
        0.0,
        1.0
    );
}
`;

export const fragmentShaderSource2d = `#version 300 es
in highp vec4 rgba;
in highp vec2 uv;
in highp vec4 image_xywh;
in lowp vec3 discard_wrapx_wrapy;
out highp vec4 col;
uniform sampler2D tex;
uniform highp vec4 atlas_wh_screen_wh;
void main() {
    if (discard_wrapx_wrapy.x > 0.5) {
        col = rgba;
    } else {
        highp vec2 atlas_wh = atlas_wh_screen_wh.st;
        highp vec2 mod_atlas_uv = (image_xywh.st + (fract((uv - (image_xywh.st / atlas_wh)) / (image_xywh.pq / atlas_wh)) * image_xywh.pq)) / atlas_wh;
        highp vec2 clamp_atlas_uv = min(max(uv * atlas_wh, image_xywh.st), image_xywh.st + image_xywh.pq) / atlas_wh;
        col = texture(tex, mix(clamp_atlas_uv, mod_atlas_uv, discard_wrapx_wrapy.yz)) * rgba;
    }
}
`;

export const vertexShaderSource3d = `#version 300 es
layout (location = 0) in highp vec4 xyz_and_bone;
layout (location = 1) in highp vec2 in_uv;
layout (location = 2) in highp vec4 in_image_xywh;
layout (location = 3) in highp vec4 in_rgba;
out highp vec4 rgba;
out highp vec2 uv;
out highp vec4 image_xywh;
uniform mat4 modelmatrix;
uniform mat4 viewmatrix;
uniform mat4 projmatrix;
uniform highp vec2 atlas_wh;
void main() {
    rgba = in_rgba;
    uv = in_uv;
    image_xywh = vec4(
        in_image_xywh.s / atlas_wh.s,
        in_image_xywh.t / atlas_wh.t,
        in_image_xywh.p / atlas_wh.s,
        in_image_xywh.q / atlas_wh.t
    );
    gl_Position = projmatrix * viewmatrix * modelmatrix * vec4(xyz_and_bone.xyz, 1.0);
}
`;

export const vertexShaderSourceAnim3d = `#version 300 es
layout (location = 0) in highp vec4 xyz_and_bone;
layout (location = 1) in highp vec2 in_uv;
layout (location = 2) in highp vec4 in_image_xywh;
layout (location = 3) in highp vec4 in_rgba;
layout (location = 4) in highp mat4 anim;
out highp vec4 rgba;
out highp vec2 uv;
out highp vec4 image_xywh;
uniform mat4 modelmatrix;
uniform mat4 viewmatrix;
uniform mat4 projmatrix;
uniform highp vec2 atlas_wh;
void main() {
    rgba = in_rgba;
    uv = in_uv;
    image_xywh = vec4(
        in_image_xywh.s / atlas_wh.s,
        in_image_xywh.t / atlas_wh.t,
        in_image_xywh.p / atlas_wh.s,
        in_image_xywh.q / atlas_wh.t
    );
    gl_Position = projmatrix * viewmatrix * modelmatrix * anim * vec4(xyz_and_bone.xyz, 1.0);
}
`;

export const fragmentShaderSource3d = `#version 300 es
in highp vec4 rgba;
in highp vec2 uv;
in highp vec4 image_xywh;
out highp vec4 col;
uniform sampler2D tex;
void main() {
    col = texture(tex, image_xywh.st + (fract(uv) * image_xywh.pq)) * rgba;
}
`;

export const vertexShaderSourceParticles = `#version 300 es
layout (location = 0) in highp vec3 xyz;
layout (location = 1) in highp vec4 in_rgba;
layout (location = 2) in highp vec2 offset2d;
layout (location = 3) in highp vec3 offset3d;
layout (location = 4) in highp vec2 in_uv;
layout (location = 5) in highp vec4 in_image_xywh;
out highp vec4 rgba;
out highp vec2 uv;
out highp vec4 image_xywh;
uniform mat4 viewmatrix;
uniform mat4 projmatrix;
uniform highp vec2 atlas_wh;
void main() {
    rgba = in_rgba;
    uv = in_uv;
    image_xywh = vec4(
        in_image_xywh.s / atlas_wh.s,
        in_image_xywh.t / atlas_wh.t,
        in_image_xywh.p / atlas_wh.s,
        in_image_xywh.q / atlas_wh.t
    );
    gl_Position = projmatrix * (vec4(offset2d, 0.0, 0.0) + (viewmatrix * vec4(xyz + offset3d, 1.0)));
}
`;

export const vertexShaderSourceCheckers = `#version 300 es
layout (location = 0) in highp vec2 in_xy;
out highp vec2 xy;
uniform highp vec2 screen_wh;
void main() {
    xy = in_xy;
    gl_Position = vec4(
        in_xy.x * 2.0 - 1.0,
        in_xy.y * 2.0 - 1.0,
        0.0,
        1.0
    );
}
`;

export const fragmentShaderSourceCheckers = `#version 300 es
in highp vec2 xy;
out highp vec4 col;
uniform highp vec2 screen_wh;
void main() {
    highp float xpixel = xy.x * screen_wh.s;
    highp float ypixel = xy.y * screen_wh.t;
    highp float rgb = mod(floor(xpixel / 24.0) + floor(ypixel / 24.0), 2.0) >= 1.0 ? 0.8 : 0.7;
    col = vec4(rgb, rgb, rgb, 1.0);
}
`;

export const batch2dAttribs: Attribute[] = [
  { count: 4, offset: 0 },
  { count: 4, offset: 16 },
  { count: 4, offset: 32 },
  { count: 3, offset: 48 },
];

export const render3dAttribs: Attribute[] = [
  { count: 4, offset: 0 },
  { count: 2, offset: 16 },
  { count: 4, offset: 24 },
  { count: 4, offset: 40 },
];

export const render3dAnimAttribs: Attribute[] = [
  { count: 4, offset: 0 },
  { count: 2, offset: 16 },
  { count: 4, offset: 24 },
  { count: 4, offset: 40 },
  { count: 4, offset: 56 },
  { count: 4, offset: 72 },
  { count: 4, offset: 88 },
  { count: 4, offset: 104 },
];

export const renderParticlesAttribs: Attribute[] = [
  { count: 3, offset: 0 },
  { count: 4, offset: 28 },
  { count: 2, offset: 44 },
  { count: 3, offset: 52 },
  { count: 2, offset: 64 },
  { count: 4, offset: 12 },
];

export const renderCheckersAttribs: Attribute[] = [{ count: 2, offset: 0 }];

export const compileShader = (
  gl: WebGLRenderingContext,
  type: GLenum,
  source: string,
  desc: string,
): WebGLShader => {
  const shader = gl.createShader(type);
  if (!shader) {
    throw new Error(`failed to create shader '${desc}'`);
  }
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader);
    throw new Error(`compilation error in shader '${desc}':\n${log}`);
  }
  return shader;
};

export const linkProgram = (
  gl: WebGLRenderingContext,
  vertex: WebGLShader,
  fragment: WebGLShader,
  desc: string,
): WebGLProgram => {
  const program = gl.createProgram();
  if (!program) {
    throw new Error(`failed to create program '${desc}'`);
  }
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  gl.detachShader(program, vertex);
  gl.detachShader(program, fragment);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const log = gl.getProgramInfoLog(program);
    throw new Error(`link error in program '${desc}':\n${log}`);
  }
  return program;
};
