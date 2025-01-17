const vertexShaderSource2d = `#version 300 es
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

const fragmentShaderSource2d = `#version 300 es
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

const vertexShaderSource3d = `#version 300 es
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

const vertexShaderSourceAnim3d = `#version 300 es
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

const fragmentShaderSource3d = `#version 300 es
in highp vec4 rgba;
in highp vec2 uv;
in highp vec4 image_xywh;
out highp vec4 col;
uniform sampler2D tex;
void main() {
    col = texture(tex, image_xywh.st + (fract(uv) * image_xywh.pq)) * rgba;
}
`;

const vertexShaderSourceParticles = `#version 300 es
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

const params = new URLSearchParams(window.location.search);
const n = params.get('n');
const estimatedVertices = n ? Math.max(parseInt(n), 1) : 1;
let receivedVertices = 0;
let done = false;
let pending = [];
const textureUnitID = 0;

let textures = {};
let entities = [];

let gl = null;
let canvas = null;
let maxAttribCount;
let projMatrix;
let minimaptex = null;
let minimapWidth;
let minimapHeight;
let minimapfb;
let identityMatrix;

const windoww = params.get('w');
const windowh = params.get('h');
const gvx = params.get('gx');
const gvy = params.get('gy');
const gvw = params.get('gw');
const gvh = params.get('gh');

let program2d = null;
let program2d_uAtlasWHScreenWH;
let program2d_uTex;

let program3d = null;
let program3d_uModelMatrix;
let program3d_uViewMatrix;
let program3d_uProjMatrix;
let program3d_uAtlasWH;
let program3d_uTex;

let programAnim3d = null;
let programAnim3d_uModelMatrix;
let programAnim3d_uViewMatrix;
let programAnim3d_uProjMatrix;
let programAnim3d_uAtlasWH;
let programAnim3d_uTex;

let programParticles = null;
let programParticles_uViewMatrix;
let programParticles_uProjMatrix;
let programParticles_uTex;
let programParticles_uAtlasWH;

const batch2dAttribs = [
    {count: 4, offset: 0},
    {count: 4, offset: 16},
    {count: 4, offset: 32},
    {count: 3, offset: 48},
];

const render3dAttribs = [
    {count: 4, offset: 0},
    {count: 2, offset: 16},
    {count: 4, offset: 24},
    {count: 4, offset: 40},
];

const render3dAnimAttribs = [
    {count: 4, offset: 0},
    {count: 2, offset: 16},
    {count: 4, offset: 24},
    {count: 4, offset: 40},
    {count: 4, offset: 56},
    {count: 4, offset: 72},
    {count: 4, offset: 88},
    {count: 4, offset: 104},
];

const renderParticlesAttribs = [
    {count: 3, offset: 0},
    {count: 4, offset: 28},
    {count: 2, offset: 44},
    {count: 3, offset: 52},
    {count: 2, offset: 64},
    {count: 4, offset: 12},
];

//const getPixelRow = (tex, vertex, row) => {
//    const t = tex;
//    const start = (vertex.ay + row) * tex.width * 4 + (vertex.ax * 4);
//    const d = t.data.slice(start, start + (vertex.aw * 4));
//    return Array.from(d).map((x) => {
//        const s = x.toString(16);
//        if (s.length === 1) {return "\\x0".concat(s);} else {return "\\x".concat(s);}
//    }).join('');
//}

const makeProjMatrix = (width, height, near, far, fov) => {
    // https://www.songho.ca/opengl/gl_projectionmatrix.html
    // the view matrix given to us by the game is slightly incorrect in that it projects the world into the positive
    // z-axis instead of the negative, so to compensate for this, the third row of this matrix is negated from what you
    // might find in a normal projection matrix. this matrix is also row-major whereas the article linked above uses
    // column-major notation.
    return new Float32Array([
        near / (width * fov), 0.0, 0.0, 0.0,
        0.0, near / (height * fov), 0.0, 0.0,
        0.0, 0.0, (far + near) / (far - near), 1.0,
        0.0, 0.0, -2 * far * near / (far - near), 0.0,
    ]);
};

const drawArraysFromEntityBuffer = (buffer, vertexCount) => {
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer.vbo);
    for (let i = 0; i < maxAttribCount; i += 1) {
        const attrib = buffer.attribs[i];
        if (!attrib) {
            gl.disableVertexAttribArray(i);
            continue;
        }
        gl.enableVertexAttribArray(i);
        gl.vertexAttribPointer(i, attrib.count, gl.FLOAT, false, buffer.step, attrib.offset);
    }
    gl.drawArrays(gl.TRIANGLES, 0, vertexCount);
};

const redraw = () => {
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.scissor(0, 0, canvas.width, canvas.height);
    gl.clearColor(0.0, 0.0, 0.0, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    
    if (done) {
        gl.disable(gl.SCISSOR_TEST);
        for (entity of entities) {
            if (entity.type === 'batch2d') {
                gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
                gl.disable(gl.DEPTH_TEST);
                const tex = textures[entity.textureId];
                gl.useProgram(program2d);
                gl.viewport(0, 0, windoww, windowh);
                gl.uniform4fv(program2d_uAtlasWHScreenWH, [tex.width, tex.height, entity.targetWidth, entity.targetHeight]);
                gl.bindTexture(gl.TEXTURE_2D, tex.texture);
                gl.uniform1i(program2d_uTex, textureUnitID);
                drawArraysFromEntityBuffer(entity.buffer, entity.vertexCount);
            }

            if (entity.type === 'render3d') {
                gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
                gl.enable(gl.DEPTH_TEST);
                const tex = textures[entity.textureId];
                gl.useProgram(entity.animated ? programAnim3d : program3d);
                gl.viewport(gvx, gvy, gvw, gvh);
                gl.uniformMatrix4fv(entity.animated ? programAnim3d_uModelMatrix : program3d_uModelMatrix, false, entity.modelMatrix);
                gl.uniformMatrix4fv(entity.animated ? programAnim3d_uViewMatrix : program3d_uViewMatrix, false, entity.viewMatrix);
                gl.uniformMatrix4fv(entity.animated ? programAnim3d_uProjMatrix : program3d_uProjMatrix, false, projMatrix);
                gl.uniform2fv(entity.animated ? programAnim3d_uAtlasWH : program3d_uAtlasWH, [tex.width, tex.height]);
                gl.bindTexture(gl.TEXTURE_2D, tex.texture);
                gl.uniform1i(entity.animated ? programAnim3d_uTex : program3d_uTex, textureUnitID);
                drawArraysFromEntityBuffer(entity.buffer, entity.vertexCount);
            }

            if (entity.type === 'renderparticles') {
                gl.blendFuncSeparate(gl.ONE, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
                gl.enable(gl.DEPTH_TEST);
                const tex = textures[entity.textureId];
                gl.useProgram(programParticles);
                gl.viewport(gvx, gvy, gvw, gvh);
                gl.uniformMatrix4fv(programParticles_uViewMatrix, false, entity.viewMatrix);
                gl.uniformMatrix4fv(programParticles_uProjMatrix, false, projMatrix);
                gl.uniform2fv(programParticles_uAtlasWH, [tex.width, tex.height]);
                gl.bindTexture(gl.TEXTURE_2D, tex.texture);
                gl.uniform1i(programParticles_uTex, textureUnitID);
                drawArraysFromEntityBuffer(entity.buffer, entity.vertexCount);
            }

            if (entity.type === 'icon' || entity.type === 'bigicon') {
                gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
                gl.disable(gl.DEPTH_TEST);
                gl.useProgram(program2d);
                gl.viewport(0, 0, windoww, windowh);
                gl.bindTexture(gl.TEXTURE_2D, entity.texture);
                gl.uniform1i(program2d_uTex, textureUnitID);
                gl.uniform4fv(program2d_uAtlasWHScreenWH, [entity.texSize, entity.texSize, entity.targetWidth, entity.targetHeight]);
                drawArraysFromEntityBuffer(entity.buffer, 6);
            }

            if (entity.type === 'minimap') {
                if (minimaptex === null) continue;
                gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
                gl.disable(gl.DEPTH_TEST);
                gl.useProgram(program2d);
                gl.viewport(0, 0, windoww, windowh);
                gl.uniform4fv(program2d_uAtlasWHScreenWH, [minimapWidth, minimapHeight, entity.targetWidth, entity.targetHeight]);
                gl.bindTexture(gl.TEXTURE_2D, minimaptex);
                gl.uniform1i(program2d_uTex, textureUnitID);
                drawArraysFromEntityBuffer(entity.buffer, 6);
            }
        }
    } else {
        gl.viewport(0, 0, canvas.width, canvas.height);
        const clearForeground = () => {
            gl.clearColor(0.525, 0.968, 0.495, 1.0);
            gl.clear(gl.COLOR_BUFFER_BIT);
        };
        const clearBackground = () => {
            gl.clearColor(0.2, 0.2, 0.2, 1.0);
            gl.clear(gl.COLOR_BUFFER_BIT);
        };
        const progress = Math.min(receivedVertices / estimatedVertices, 1.0);
        const barInnerWidth = Math.floor(canvas.width * 0.65) & ~1;
        const barInnerHeight = 70;
        const barThickness = 8;
        const barDoubleThickness = barThickness * 2;
        const barProgressWidth = barInnerWidth * progress;
        clearForeground();
        if (canvas.width <= barDoubleThickness || canvas.height <= barDoubleThickness) return;
        gl.scissor(barThickness, barThickness, canvas.width - barDoubleThickness, canvas.height - barDoubleThickness);
        clearBackground();
        gl.scissor(
            (canvas.width / 2) - ((barInnerWidth / 2) + barThickness),
            (canvas.height / 2) - ((barInnerHeight / 2) + barThickness),
            barInnerWidth + barDoubleThickness,
            barInnerHeight + barDoubleThickness,
        );
        clearForeground();
        gl.scissor(
            ((canvas.width / 2) - (barInnerWidth / 2)) + barProgressWidth,
            (canvas.height / 2) - (barInnerHeight / 2),
            barInnerWidth - barProgressWidth,
            barInnerHeight,
        );
        clearBackground();
    }
};

const handleMessage = (message) => {
    const arr = new DataView(message);
    const msgtype = arr.getUint32(0, true);
    switch (msgtype) {
        case 0: {
            done = true;
            redraw();
            break;
        }
        case 1: {
            const textureid = arr.getUint32(4, true);
            const width = arr.getUint32(8, true);
            const height = arr.getUint32(12, true);
            const texture = gl.createTexture();
            const data = new Uint8Array(message, 16, width * height * 4);
            gl.bindTexture(gl.TEXTURE_2D, texture);
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, data);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
            textures[textureid] = {
                texture,
                width,
                height,
                data,
            };
            break;
        }
        case 2:
        case 3: {
            const animated = msgtype === 3;
            const vertexMsgSize = animated ? 104 : 40;
            const vertexBufferSize = animated ? 120 : 56;
            const vertexCount = arr.getUint32(4, true);
            const textureId = arr.getUint32(8, true);
            const modelMatrix = new Float32Array(16);
            modelMatrix.set(new Float32Array(message, 16, 16));
            const viewMatrix = new Float32Array(16);
            viewMatrix.set(new Float32Array(message, 80, 16));

            const data = new DataView(message, 144, vertexCount * vertexMsgSize);
            const vertices = new Array(vertexCount);
            const bufferDataArray = new ArrayBuffer(vertexCount * vertexBufferSize);
            const bufferData = new DataView(bufferDataArray);

            for (let i = 0; i < vertexCount; i += 1) {
                const srcOffset = vertexMsgSize * i;
                const dstOffset = vertexBufferSize * i;
                let anim = null;
                if (animated) {
                    anim = new Float32Array(16);
                    anim.set(new Float32Array(message, 144 + (vertexMsgSize * i) + 40, 16));
                }

                const vertex = {
                    x: data.getInt16(srcOffset, true),
                    y: data.getInt16(srcOffset + 2, true),
                    z: data.getInt16(srcOffset + 4, true),
                    u: data.getFloat32(srcOffset + 8, true),
                    v: data.getFloat32(srcOffset + 12, true),
                    ax: data.getUint16(srcOffset + 16, true),
                    ay: data.getUint16(srcOffset + 18, true),
                    aw: data.getUint16(srcOffset + 20, true),
                    ah: data.getUint16(srcOffset + 22, true),
                    r: data.getFloat32(srcOffset + 24, true),
                    g: data.getFloat32(srcOffset + 28, true),
                    b: data.getFloat32(srcOffset + 32, true),
                    a: data.getFloat32(srcOffset + 36, true),
                    anim,
                };
                vertices[i] = vertex;

                bufferData.setFloat32(dstOffset, vertex.x, true);
                bufferData.setFloat32(dstOffset + 4, vertex.y, true);
                bufferData.setFloat32(dstOffset + 8, vertex.z, true);
                bufferData.setFloat32(dstOffset + 12, 0, true);
                bufferData.setFloat32(dstOffset + 16, vertex.u, true);
                bufferData.setFloat32(dstOffset + 20, vertex.v, true);
                bufferData.setFloat32(dstOffset + 24, vertex.ax, true);
                bufferData.setFloat32(dstOffset + 28, vertex.ay, true);
                bufferData.setFloat32(dstOffset + 32, vertex.aw, true);
                bufferData.setFloat32(dstOffset + 36, vertex.ah, true);
                bufferData.setFloat32(dstOffset + 40, vertex.r, true);
                bufferData.setFloat32(dstOffset + 44, vertex.g, true);
                bufferData.setFloat32(dstOffset + 48, vertex.b, true);
                bufferData.setFloat32(dstOffset + 52, vertex.a, true);
                if (animated) {
                    for (let j = 0; j < 16; j += 1) {
                        bufferData.setFloat32(dstOffset + 56 + (j * 4), anim[j], true);
                    }
                }
            }

            const vbo = gl.createBuffer();
            gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
            gl.bufferData(gl.ARRAY_BUFFER, bufferData, gl.STATIC_DRAW);
            entities.push({
                type: 'render3d',
                animated,
                textureId,
                vertexCount,
                modelMatrix,
                viewMatrix,
                vertices,
                buffer: {
                    vbo,
                    step: vertexBufferSize,
                    attribs: animated ? render3dAnimAttribs : render3dAttribs,
                },
            });
            receivedVertices += vertexCount;
            redraw();
            break;
        }
        case 4: {
            const vertexMsgSize = 40;
            const vertexBufferSize = 60;
            const vertexCount = arr.getUint32(4, true);
            const textureId = arr.getUint32(8, true);
            const targetWidth = arr.getUint16(12, true);
            const targetHeight = arr.getUint16(14, true);
            const vbo = gl.createBuffer();
            gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
            const data = new DataView(message, 16, vertexCount * 40);
            const bufferDataArray = new ArrayBuffer(vertexCount * vertexBufferSize);
            const bufferData = new DataView(bufferDataArray);

            const vertices = new Array(vertexCount);
            for (let i = 0; i < vertexCount; i += 1) {
                const srcOffset = vertexMsgSize * i;
                const dstOffset = vertexBufferSize * i;

                const vertex = {
                    x: data.getInt16(srcOffset, true),
                    y: data.getInt16(srcOffset + 2, true),
                    ax: data.getInt16(srcOffset + 4, true),
                    ay: data.getInt16(srcOffset + 6, true),
                    aw: data.getInt16(srcOffset + 8, true),
                    ah: data.getInt16(srcOffset + 10, true),
                    discard: data.getUint8(srcOffset + 12),
                    wrapx: data.getUint8(srcOffset + 13),
                    wrapy: data.getUint8(srcOffset + 14),
                    u: data.getFloat32(srcOffset + 16, true),
                    v: data.getFloat32(srcOffset + 20, true),
                    r: data.getFloat32(srcOffset + 24, true),
                    g: data.getFloat32(srcOffset + 28, true),
                    b: data.getFloat32(srcOffset + 32, true),
                    a: data.getFloat32(srcOffset + 36, true),
                };
                vertices[i] = vertex;

                bufferData.setFloat32(dstOffset, vertex.x, true);
                bufferData.setFloat32(dstOffset + 4, vertex.y, true);
                bufferData.setFloat32(dstOffset + 8, vertex.u, true);
                bufferData.setFloat32(dstOffset + 12, vertex.v, true);
                bufferData.setFloat32(dstOffset + 16, vertex.ax, true);
                bufferData.setFloat32(dstOffset + 20, vertex.ay, true);
                bufferData.setFloat32(dstOffset + 24, vertex.aw, true);
                bufferData.setFloat32(dstOffset + 28, vertex.ah, true);
                bufferData.setFloat32(dstOffset + 32, vertex.r, true);
                bufferData.setFloat32(dstOffset + 36, vertex.g, true);
                bufferData.setFloat32(dstOffset + 40, vertex.b, true);
                bufferData.setFloat32(dstOffset + 44, vertex.a, true);
                bufferData.setFloat32(dstOffset + 48, vertex.discard, true);
                bufferData.setFloat32(dstOffset + 52, vertex.wrapx, true);
                bufferData.setFloat32(dstOffset + 56, vertex.wrapy, true);
            }

            gl.bufferData(gl.ARRAY_BUFFER, bufferData, gl.STATIC_DRAW);
            entities.push({
                type: 'batch2d',
                textureId,
                vertexCount,
                vertices,
                targetWidth,
                targetHeight,
                buffer: {
                    vbo,
                    step: vertexBufferSize,
                    attribs: batch2dAttribs,
                },
            });
            receivedVertices += vertexCount;
            redraw();
            break;
        }
        case 5:
        case 8: {
            const step = 56;
            const texSize = msgtype === 5 ? 64 : 512;
            const targetx = arr.getInt16(4, true);
            const targety = arr.getInt16(6, true);
            const targetw = arr.getInt16(8, true);
            const targeth = arr.getInt16(10, true);
            const modelcount = arr.getUint32(12, true);
            const red = arr.getFloat32(16, true);
            const blue = arr.getFloat32(20, true);
            const green = arr.getFloat32(24, true);
            const alpha = arr.getFloat32(28, true);
            const targetWidth = arr.getUint16(32, true);
            const targetHeight = arr.getUint16(34, true);
            const texture = gl.createTexture();
            const fb = gl.createFramebuffer();
            gl.bindTexture(gl.TEXTURE_2D, texture);
            gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, fb);
            gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA8, texSize, texSize);
            gl.framebufferTexture2D(gl.DRAW_FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
            gl.disable(gl.SCISSOR_TEST);
            gl.enable(gl.CULL_FACE);
            gl.cullFace(gl.FRONT);
            gl.viewport(0, 0, texSize, texSize);
            gl.clearColor(0, 0, 0, 0);
            gl.clear(gl.COLOR_BUFFER_BIT);

            let models = Array(modelcount);
            let cursor = 36;
            for (let model = 0; model < modelcount; model += 1) {
                const vertexcount = arr.getUint32(cursor, true);
                let vertices = Array(vertexcount);
                const bufferDataArray = new ArrayBuffer(vertexcount * step);
                const bufferData = new DataView(bufferDataArray);
                const modelMatrix = new Float32Array(16);
                modelMatrix.set(new Float32Array(message, cursor + 4, 16));
                const viewMatrix = new Float32Array(16);
                viewMatrix.set(new Float32Array(message, cursor + 68, 16));
                const projMatrix = new Float32Array(16);
                projMatrix.set(new Float32Array(message, cursor + 132, 16));
                cursor += 196;
                for (let vertex = 0; vertex < vertexcount; vertex += 1) {
                    const v = {
                        x: arr.getInt16(cursor, true),
                        y: arr.getInt16(cursor + 2, true),
                        z: arr.getInt16(cursor + 4, true),
                        r: arr.getFloat32(cursor + 8, true),
                        g: arr.getFloat32(cursor + 12, true),
                        b: arr.getFloat32(cursor + 16, true),
                        a: arr.getFloat32(cursor + 20, true),
                    };
                    const bufferDataOffset = vertex * step;
                    bufferData.setFloat32(bufferDataOffset, v.x, true);
                    bufferData.setFloat32(bufferDataOffset + 4, v.y, true);
                    bufferData.setFloat32(bufferDataOffset + 8, v.z, true);
                    bufferData.setFloat32(bufferDataOffset + 24, 0, true);
                    bufferData.setFloat32(bufferDataOffset + 28, 0, true);
                    bufferData.setFloat32(bufferDataOffset + 32, texSize, true);
                    bufferData.setFloat32(bufferDataOffset + 36, texSize, true);
                    bufferData.setFloat32(bufferDataOffset + 40, v.r, true);
                    bufferData.setFloat32(bufferDataOffset + 44, v.g, true);
                    bufferData.setFloat32(bufferDataOffset + 48, v.b, true);
                    bufferData.setFloat32(bufferDataOffset + 52, v.a, true);
                    vertices[vertex] = v;
                    cursor += 24;
                }
                models[model] = {
                    vertices,
                    modelMatrix,
                    viewMatrix,
                    projMatrix,
                };

                const buffer = gl.createBuffer();
                gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
                gl.bufferData(gl.ARRAY_BUFFER, bufferData, gl.STATIC_DRAW);
                gl.useProgram(program3d);
                gl.uniformMatrix4fv(program3d_uModelMatrix, false, modelMatrix);
                gl.uniformMatrix4fv(program3d_uViewMatrix, false, viewMatrix);
                gl.uniformMatrix4fv(program3d_uProjMatrix, false, projMatrix);
                gl.uniform2fv(program3d_uAtlasWH, [1, 1]);
                gl.bindTexture(gl.TEXTURE_2D, whitePixelTex);
                gl.uniform1i(program3d_uTex, textureUnitID);
                for (let i = 0; i < maxAttribCount; i += 1) {
                    i < 4 ? gl.enableVertexAttribArray(i) : gl.disableVertexAttribArray(i);
                }
                gl.vertexAttribPointer(0, 4, gl.FLOAT, false, step, 0);
                gl.vertexAttribPointer(1, 2, gl.FLOAT, false, step, 16);
                gl.vertexAttribPointer(2, 4, gl.FLOAT, false, step, 24);
                gl.vertexAttribPointer(3, 4, gl.FLOAT, false, step, 40);
                gl.drawArrays(gl.TRIANGLES, 0, vertexcount);
                gl.deleteBuffer(buffer);
            }
            const x1 = targetx;
            const x2 = targetx + targetw;
            const y1 = targety;
            const y2 = targety + targeth;
            const vbo = gl.createBuffer();
            gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
            gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
                x1, y1, 0, 1, 0, 0, texSize, texSize, red, green, blue, alpha, 0, 0, 0,
                x2, y1, 1, 1, 0, 0, texSize, texSize, red, green, blue, alpha, 0, 0, 0,
                x1, y2, 0, 0, 0, 0, texSize, texSize, red, green, blue, alpha, 0, 0, 0,
                x2, y1, 1, 1, 0, 0, texSize, texSize, red, green, blue, alpha, 0, 0, 0,
                x2, y2, 1, 0, 0, 0, texSize, texSize, red, green, blue, alpha, 0, 0, 0,
                x1, y2, 0, 0, 0, 0, texSize, texSize, red, green, blue, alpha, 0, 0, 0,
            ]), gl.STATIC_DRAW);
            entities.push({
                type: msgtype === 5 ? 'icon' : 'bigicon',
                models,
                texture,
                targetWidth,
                targetHeight,
                texSize,
                buffer: {
                    vbo,
                    step: 60,
                    attribs: batch2dAttribs,
                },
            });
            gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, null);
            gl.deleteFramebuffer(fb);
            gl.disable(gl.CULL_FACE);
            break;
        }
        case 6: {
            const vertexCount = arr.getUint32(4, true);
            const textureId = arr.getUint32(8, true);
            minimapWidth = arr.getUint16(12, true);
            minimapHeight = arr.getUint16(14, true);
            const vbo = gl.createBuffer();
            gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
            const data = new DataView(message, 16, vertexCount * 40);
            const bufferDataArray = new ArrayBuffer(vertexCount * 60);
            const bufferData = new DataView(bufferDataArray);

            const vertices = new Array(vertexCount);
            for (let i = 0; i < vertexCount; i += 1) {
                const srcOffset = 40 * i;
                const dstOffset = 60 * i;

                const vertex = {
                    x: data.getInt16(srcOffset, true),
                    y: data.getInt16(srcOffset + 2, true),
                    ax: data.getInt16(srcOffset + 4, true),
                    ay: data.getInt16(srcOffset + 6, true),
                    aw: data.getInt16(srcOffset + 8, true),
                    ah: data.getInt16(srcOffset + 10, true),
                    discard: data.getUint8(srcOffset + 12),
                    wrapx: data.getUint8(srcOffset + 13),
                    wrapy: data.getUint8(srcOffset + 14),
                    u: data.getFloat32(srcOffset + 16, true),
                    v: data.getFloat32(srcOffset + 20, true),
                    r: data.getFloat32(srcOffset + 24, true),
                    g: data.getFloat32(srcOffset + 28, true),
                    b: data.getFloat32(srcOffset + 32, true),
                    a: data.getFloat32(srcOffset + 36, true),
                };
                vertices[i] = vertex;

                bufferData.setFloat32(dstOffset, vertex.x, true);
                bufferData.setFloat32(dstOffset + 4, vertex.y, true);
                bufferData.setFloat32(dstOffset + 8, vertex.u, true);
                bufferData.setFloat32(dstOffset + 12, vertex.v, true);
                bufferData.setFloat32(dstOffset + 16, vertex.ax, true);
                bufferData.setFloat32(dstOffset + 20, vertex.ay, true);
                bufferData.setFloat32(dstOffset + 24, vertex.aw, true);
                bufferData.setFloat32(dstOffset + 28, vertex.ah, true);
                bufferData.setFloat32(dstOffset + 32, vertex.r, true);
                bufferData.setFloat32(dstOffset + 36, vertex.g, true);
                bufferData.setFloat32(dstOffset + 40, vertex.b, true);
                bufferData.setFloat32(dstOffset + 44, vertex.a, true);
                bufferData.setFloat32(dstOffset + 48, vertex.discard, true);
                bufferData.setFloat32(dstOffset + 52, vertex.wrapx, true);
                bufferData.setFloat32(dstOffset + 56, vertex.wrapy, true);
            }
            gl.bufferData(gl.ARRAY_BUFFER, bufferData, gl.STATIC_DRAW);

            if (!minimaptex) {
                minimaptex = gl.createTexture();
                gl.bindTexture(gl.TEXTURE_2D, minimaptex);
                gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA8, minimapWidth, minimapHeight);
                minimapfb = gl.createFramebuffer();
                gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, minimapfb);
                gl.framebufferTexture2D(gl.DRAW_FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, minimaptex, 0);
                gl.bindTexture(gl.TEXTURE_2D, null);
            } else {
                gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, minimapfb);
            }

            gl.viewport(0, 0, minimapWidth, minimapHeight);
            gl.scissor(0, 0, minimapWidth, minimapHeight);
            gl.disable(gl.DEPTH_TEST);
            const tex = textures[textureId];
            gl.useProgram(program2d);
            gl.uniform4fv(program2d_uAtlasWHScreenWH, [tex.width, tex.height, minimapWidth, minimapHeight]);
            gl.bindTexture(gl.TEXTURE_2D, tex.texture);
            gl.uniform1i(program2d_uTex, textureUnitID);
            for (let i = 0; i < maxAttribCount; i += 1) {
                i < 4 ? gl.enableVertexAttribArray(i) : gl.disableVertexAttribArray(i);
            }
            gl.vertexAttribPointer(0, 4, gl.FLOAT, false, 60, 0);
            gl.vertexAttribPointer(1, 4, gl.FLOAT, false, 60, 16);
            gl.vertexAttribPointer(2, 4, gl.FLOAT, false, 60, 32);
            gl.vertexAttribPointer(3, 3, gl.FLOAT, false, 60, 48);
            gl.drawArrays(gl.TRIANGLES, 0, vertexCount);

            gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, null);
            entities.push({
                type: 'minimap2d',
                textureId,
                vbo,
                vertices,
            });
            receivedVertices += vertexCount;
            redraw();
            break;
        }
        case 7: {
            if (!minimaptex) break;
            const sourcex = arr.getInt16(4, true);
            const sourcey = arr.getInt16(6, true);
            const sourcew = arr.getUint16(8, true);
            const sourceh = arr.getUint16(10, true);
            const targetx = arr.getInt16(12, true);
            const targety = arr.getInt16(14, true);
            const targetw = arr.getUint16(16, true);
            const targeth = arr.getUint16(18, true);
            const targetWidth = arr.getUint16(20, true);
            const targetHeight = arr.getUint16(22, true);
            const x1 = targetx;
            const x2 = targetx + targetw;
            const y1 = targety;
            const y2 = targety + targeth;
            const u1 = sourcex / minimapWidth;
            const u2 = (sourcex + sourcew) / minimapWidth;
            const v1 = sourcey / minimapHeight;
            const v2 = (sourcey + sourceh) / minimapHeight;
            const vbo = gl.createBuffer();
            gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
            gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
                x1, y1, u1, v2, sourcex, sourcey, sourcew, sourceh, 1, 1, 1, 1, 0, 0, 0,
                x2, y1, u2, v2, sourcex, sourcey, sourcew, sourceh, 1, 1, 1, 1, 0, 0, 0,
                x1, y2, u1, v1, sourcex, sourcey, sourcew, sourceh, 1, 1, 1, 1, 0, 0, 0,
                x2, y1, u2, v2, sourcex, sourcey, sourcew, sourceh, 1, 1, 1, 1, 0, 0, 0,
                x2, y2, u2, v1, sourcex, sourcey, sourcew, sourceh, 1, 1, 1, 1, 0, 0, 0,
                x1, y2, u1, v1, sourcex, sourcey, sourcew, sourceh, 1, 1, 1, 1, 0, 0, 0,
            ]), gl.STATIC_DRAW);
            entities.push({
                type: 'minimap',
                sourcex,
                sourcey,
                sourcew,
                sourceh,
                targetx,
                targety,
                targetw,
                targeth,
                targetWidth,
                targetHeight,
                buffer: {
                    vbo,
                    step: 60,
                    attribs: batch2dAttribs,
                },
            });
            redraw();
            break;
        }
        case 9: {
            const vertexCount = arr.getUint32(4, true);
            const textureId = arr.getUint32(8, true);

            const vertexMsgSize = 64;
            const vertexBufferSize = 72;
            const viewMatrix = new Float32Array(16);
            viewMatrix.set(new Float32Array(message, 16, 16));
            const data = new DataView(message, 80, vertexCount * vertexMsgSize);
            const vertices = new Array(vertexCount);
            const bufferDataArray = new ArrayBuffer(vertexCount * vertexBufferSize);
            const bufferData = new DataView(bufferDataArray);

            for (let i = 0; i < vertexCount; i += 1) {
                const srcOffset = vertexMsgSize * i;
                const dstOffset = vertexBufferSize * i;

                const vertex = {
                    x: data.getFloat32(srcOffset, true),
                    y: data.getFloat32(srcOffset + 4, true),
                    z: data.getFloat32(srcOffset + 8, true),
                    offsetx2d: data.getFloat32(srcOffset + 12, true),
                    offsety2d: data.getFloat32(srcOffset + 16, true),
                    offsetx3d: data.getFloat32(srcOffset + 20, true),
                    offsety3d: data.getFloat32(srcOffset + 24, true),
                    offsetz3d: data.getFloat32(srcOffset + 28, true),
                    ax: data.getUint16(srcOffset + 32, true),
                    ay: data.getUint16(srcOffset + 34, true),
                    aw: data.getUint16(srcOffset + 36, true),
                    ah: data.getUint16(srcOffset + 38, true),
                    r: data.getFloat32(srcOffset + 40, true),
                    g: data.getFloat32(srcOffset + 44, true),
                    b: data.getFloat32(srcOffset + 48, true),
                    a: data.getFloat32(srcOffset + 52, true),
                    u: data.getFloat32(srcOffset + 56, true),
                    v: data.getFloat32(srcOffset + 60, true),
                };
                vertices[i] = vertex;

                bufferData.setFloat32(dstOffset, vertex.x, true);
                bufferData.setFloat32(dstOffset + 4, vertex.y, true);
                bufferData.setFloat32(dstOffset + 8, vertex.z, true);
                bufferData.setFloat32(dstOffset + 12, vertex.ax, true);
                bufferData.setFloat32(dstOffset + 16, vertex.ay, true);
                bufferData.setFloat32(dstOffset + 20, vertex.aw, true);
                bufferData.setFloat32(dstOffset + 24, vertex.ah, true);
                bufferData.setFloat32(dstOffset + 28, vertex.r, true);
                bufferData.setFloat32(dstOffset + 32, vertex.g, true);
                bufferData.setFloat32(dstOffset + 36, vertex.b, true);
                bufferData.setFloat32(dstOffset + 40, vertex.a, true);
                bufferData.setFloat32(dstOffset + 44, vertex.offsetx2d, true);
                bufferData.setFloat32(dstOffset + 48, vertex.offsety2d, true);
                bufferData.setFloat32(dstOffset + 52, vertex.offsetx3d, true);
                bufferData.setFloat32(dstOffset + 56, vertex.offsety3d, true);
                bufferData.setFloat32(dstOffset + 60, vertex.offsetz3d, true);
                bufferData.setFloat32(dstOffset + 64, vertex.u, true);
                bufferData.setFloat32(dstOffset + 68, vertex.v, true);
            }

            const vbo = gl.createBuffer();
            gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
            gl.bufferData(gl.ARRAY_BUFFER, bufferData, gl.STATIC_DRAW);
            entities.push({
                type: 'renderparticles',
                textureId,
                vertexCount,
                vertices,
                viewMatrix,
                buffer: {
                    vbo,
                    step: vertexBufferSize,
                    attribs: renderParticlesAttribs,
                }
            });
            receivedVertices += vertexCount;
            redraw();
            break;
        }
    }
};

window.addEventListener('DOMContentLoaded', () => {
    canvas = document.createElement('canvas');
    gl = canvas.getContext('webgl2');
    maxAttribCount = gl.getParameter(gl.MAX_VERTEX_ATTRIBS);
    canvas.width = windoww;
    canvas.height = windowh;

    identityMatrix = new Float32Array([
        1, 0, 0, 0,
        0, 1, 0, 0,
        0, 0, 1, 0,
        0, 0, 0, 1,
    ]);

    whitePixelTex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, whitePixelTex);
    const texData = new Uint8Array([0xFF, 0xFF, 0xFF, 0xFF]);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, texData);

    // these values look to roughly match the ones used by the game, or near enough not to matter
    projMatrix = makeProjMatrix(gvw, gvh, 460, 65536 + 1024, 5 / 16);

    const compileShader = (type, source, desc) => {
        const shader = gl.createShader(type);
        gl.shaderSource(shader, source);
        gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            const log = gl.getShaderInfoLog(shader);
            throw new Error(`compilation error in shader '${desc}':\n${log}`);
        }
        return shader;
    };

    const linkProgram = (vertex, fragment, desc) => {
        const program = gl.createProgram();
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

    const vertexShader2d = compileShader(gl.VERTEX_SHADER, vertexShaderSource2d, "2D vertex shader");
    const fragmentShader2d = compileShader(gl.FRAGMENT_SHADER, fragmentShaderSource2d, "2D fragment shader");
    const vertexShader3d = compileShader(gl.VERTEX_SHADER, vertexShaderSource3d, "3D vertex shader");
    const vertexShaderAnim3d = compileShader(gl.VERTEX_SHADER, vertexShaderSourceAnim3d, "3D anim vertex shader");
    const fragmentShader3d = compileShader(gl.FRAGMENT_SHADER, fragmentShaderSource3d, "3D fragment shader");
    const vertexShaderParticles = compileShader(gl.VERTEX_SHADER, vertexShaderSourceParticles, "particle vertex shader");

    program2d = linkProgram(vertexShader2d, fragmentShader2d, "2D program");
    program2d_uAtlasWHScreenWH = gl.getUniformLocation(program2d, 'atlas_wh_screen_wh');
    program2d_uTex = gl.getUniformLocation(program2d, 'tex');

    program3d = linkProgram(vertexShader3d, fragmentShader3d, "3D program");
    program3d_uModelMatrix = gl.getUniformLocation(program3d, 'modelmatrix');
    program3d_uViewMatrix = gl.getUniformLocation(program3d, 'viewmatrix');
    program3d_uProjMatrix = gl.getUniformLocation(program3d, 'projmatrix');
    program3d_uAtlasWH = gl.getUniformLocation(program3d, 'atlas_wh');
    program3d_uTex = gl.getUniformLocation(program3d, 'tex');

    programAnim3d = linkProgram(vertexShaderAnim3d, fragmentShader3d);
    programAnim3d_uModelMatrix = gl.getUniformLocation(programAnim3d, 'modelmatrix');
    programAnim3d_uViewMatrix = gl.getUniformLocation(programAnim3d, 'viewmatrix');
    programAnim3d_uProjMatrix = gl.getUniformLocation(programAnim3d, 'projmatrix');
    programAnim3d_uAtlasWH = gl.getUniformLocation(programAnim3d, 'atlas_wh');
    programAnim3d_uTex = gl.getUniformLocation(programAnim3d, 'tex');

    programParticles = linkProgram(vertexShaderParticles, fragmentShader3d);
    programParticles_uViewMatrix = gl.getUniformLocation(programParticles, 'viewmatrix');
    programParticles_uProjMatrix = gl.getUniformLocation(programParticles, 'projmatrix');
    programParticles_uTex = gl.getUniformLocation(programParticles, 'tex');
    programParticles_uAtlasWH = gl.getUniformLocation(programParticles, 'atlas_wh');

    gl.deleteShader(vertexShader2d);
    gl.deleteShader(fragmentShader2d);
    gl.deleteShader(vertexShader3d);
    gl.deleteShader(fragmentShader3d);
    gl.deleteShader(vertexShaderAnim3d);
    gl.deleteShader(vertexShaderParticles);
    
    gl.activeTexture(gl.TEXTURE0 + textureUnitID);
    gl.enable(gl.SCISSOR_TEST);
    gl.disable(gl.CULL_FACE);
    gl.disable(gl.DEPTH_TEST);
    gl.enable(gl.BLEND);
    gl.blendEquationSeparate(gl.FUNC_ADD, gl.FUNC_ADD);
    gl.depthFunc(gl.LEQUAL);

    for (i in pending) {
        handleMessage(pending[i]);
    }
    pending = null;

    document.body.appendChild(canvas);
    redraw();
});

window.addEventListener('message', async (event) => {
    if (typeof(event.data) !== "object") return;

    if (event.data.type === "pluginMessage") {
        if (typeof(event.data.content) !== "object") return;
        if (gl) {
            handleMessage(event.data.content);
        } else {
            pending.push(event.data.content);
        }
    }
});
