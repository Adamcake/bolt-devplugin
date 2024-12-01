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

const params = new URLSearchParams(window.location.search);
const n = params.get('n');
const estimatedVertices = n ? Math.max(parseInt(n), 1) : 1;
let receivedVertices = 0;
let done = false;
let pending = [];

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

const redraw = () => {
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.scissor(0, 0, canvas.width, canvas.height);
    gl.clearColor(0.0, 0.0, 0.0, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    
    if (done) {
        gl.disable(gl.SCISSOR_TEST);
        for (entity of entities) {
            if (entity.type === 'batch2d') {
                gl.disable(gl.DEPTH_TEST);
                const tex = textures[entity.textureId];
                gl.useProgram(program2d);
                gl.viewport(0, 0, windoww, windowh);
                gl.uniform4fv(program2d_uAtlasWHScreenWH, [tex.width, tex.height, entity.targetWidth, entity.targetHeight]);
                gl.bindTexture(gl.TEXTURE_2D, tex.texture);
                gl.uniform1i(program2d_uTex, 0); // because we activated TEXTURE0 earlier
                gl.bindBuffer(gl.ARRAY_BUFFER, entity.vbo);
                for (let i = 0; i < maxAttribCount; i += 1) {
                    i < 4 ? gl.enableVertexAttribArray(i) : gl.disableVertexAttribArray(i);
                }
                gl.vertexAttribPointer(0, 4, gl.FLOAT, false, 60, 0);
                gl.vertexAttribPointer(1, 4, gl.FLOAT, false, 60, 16);
                gl.vertexAttribPointer(2, 4, gl.FLOAT, false, 60, 32);
                gl.vertexAttribPointer(3, 3, gl.FLOAT, false, 60, 48);
                gl.drawArrays(gl.TRIANGLES, 0, entity.vertexCount);
            }

            if (entity.type === 'render3d') {
                gl.enable(gl.DEPTH_TEST);
                const step = entity.animated ? 120 : 56;
                const tex = textures[entity.textureId];
                gl.useProgram(entity.animated ? programAnim3d : program3d);
                gl.viewport(gvx, gvy, gvw, gvh);
                gl.uniformMatrix4fv(entity.animated ? programAnim3d_uModelMatrix : program3d_uModelMatrix, false, entity.modelMatrix);
                gl.uniformMatrix4fv(entity.animated ? programAnim3d_uViewMatrix : program3d_uViewMatrix, false, entity.viewMatrix);
                gl.uniformMatrix4fv(entity.animated ? programAnim3d_uProjMatrix : program3d_uProjMatrix, false, projMatrix);
                gl.uniform2fv(entity.animated ? programAnim3d_uAtlasWH : program3d_uAtlasWH, [tex.width, tex.height]);
                gl.bindTexture(gl.TEXTURE_2D, tex.texture);
                gl.uniform1i(entity.animated ? programAnim3d_uTex : program3d_uTex, 0); // because we activated TEXTURE0 earlier
                gl.bindBuffer(gl.ARRAY_BUFFER, entity.vbo);
                for (let i = 0; i < maxAttribCount; i += 1) {
                    i < (entity.animated ? 8 : 4) ? gl.enableVertexAttribArray(i) : gl.disableVertexAttribArray(i);
                }
                gl.vertexAttribPointer(0, 4, gl.FLOAT, false, step, 0);
                gl.vertexAttribPointer(1, 2, gl.FLOAT, false, step, 16);
                gl.vertexAttribPointer(2, 4, gl.FLOAT, false, step, 24);
                gl.vertexAttribPointer(3, 4, gl.FLOAT, false, step, 40);
                if (entity.animated) {
                    gl.vertexAttribPointer(4, 4, gl.FLOAT, false, step, 56);
                    gl.vertexAttribPointer(5, 4, gl.FLOAT, false, step, 72);
                    gl.vertexAttribPointer(6, 4, gl.FLOAT, false, step, 88);
                    gl.vertexAttribPointer(7, 4, gl.FLOAT, false, step, 104);
                }
                gl.drawArrays(gl.TRIANGLES, 0, entity.vertexCount);
            }

            if (entity.type === 'itemicon') {
                gl.disable(gl.DEPTH_TEST);
                gl.useProgram(program2d);
                gl.viewport(0, 0, windoww, windowh);
                gl.bindTexture(gl.TEXTURE_2D, entity.texture);
                gl.uniform1i(program2d_uTex, 0); // because we activated TEXTURE0 earlier
                gl.uniform4fv(program2d_uAtlasWHScreenWH, [64, 64, entity.targetWidth, entity.targetHeight]);
                gl.bindBuffer(gl.ARRAY_BUFFER, entity.buffer);
                for (let i = 0; i < maxAttribCount; i += 1) {
                    i < 4 ? gl.enableVertexAttribArray(i) : gl.disableVertexAttribArray(i);
                }
                gl.vertexAttribPointer(0, 4, gl.FLOAT, false, 60, 0);
                gl.vertexAttribPointer(1, 4, gl.FLOAT, false, 60, 16);
                gl.vertexAttribPointer(2, 4, gl.FLOAT, false, 60, 32);
                gl.vertexAttribPointer(3, 3, gl.FLOAT, false, 60, 48);
                gl.drawArrays(gl.TRIANGLES, 0, 6);
            }

            if (entity.type === 'minimap') {
                if (minimaptex === null) continue;
                gl.disable(gl.DEPTH_TEST);
                gl.useProgram(program2d);
                gl.viewport(0, 0, windoww, windowh);
                gl.uniform4fv(program2d_uAtlasWHScreenWH, [minimapWidth, minimapHeight, entity.targetWidth, entity.targetHeight]);
                gl.bindTexture(gl.TEXTURE_2D, minimaptex);
                gl.uniform1i(program2d_uTex, 0); // because we activated TEXTURE0 earlier
                gl.bindBuffer(gl.ARRAY_BUFFER, entity.buffer);
                for (let i = 0; i < maxAttribCount; i += 1) {
                    i < 4 ? gl.enableVertexAttribArray(i) : gl.disableVertexAttribArray(i);
                }
                gl.vertexAttribPointer(0, 4, gl.FLOAT, false, 60, 0);
                gl.vertexAttribPointer(1, 4, gl.FLOAT, false, 60, 16);
                gl.vertexAttribPointer(2, 4, gl.FLOAT, false, 60, 32);
                gl.vertexAttribPointer(3, 3, gl.FLOAT, false, 60, 48);
                gl.drawArrays(gl.TRIANGLES, 0, 6);
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
            gl.bindTexture(gl.TEXTURE_2D, texture);
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(message, 16, width * height * 4));
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
            textures[textureid] = {
                texture,
                width,
                height,
            };
            break;
        }
        case 2:
        case 3: {
            const animated = msgtype === 3;
            const vertexMsgSize = animated ? 120 : 56;
            const vertexCount = arr.getUint32(4, true);
            const textureId = arr.getUint32(8, true);
            const modelMatrix = new Float32Array(16);
            modelMatrix.set(new Float32Array(message, 16, 16));
            const viewMatrix = new Float32Array(16);
            viewMatrix.set(new Float32Array(message, 80, 16));
            const vbo = gl.createBuffer();
            gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
            const bufferData = new DataView(message, 144, vertexCount * vertexMsgSize);
            gl.bufferData(gl.ARRAY_BUFFER, bufferData, gl.STATIC_DRAW);
            entities.push({
                type: 'render3d',
                animated,
                textureId,
                vbo,
                vertexCount,
                modelMatrix,
                viewMatrix,
            });
            receivedVertices += vertexCount;
            redraw();
            break;
        }
        case 4: {
            const vertexCount = arr.getUint32(4, true);
            const textureId = arr.getUint32(8, true);
            const targetWidth = arr.getUint16(12, true);
            const targetHeight = arr.getUint16(14, true);
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
            entities.push({
                type: 'batch2d',
                textureId,
                vbo,
                vertexCount,
                vertices,
                targetWidth,
                targetHeight,
            });
            receivedVertices += vertexCount;
            redraw();
            break;
        }
        case 5: {
            const step = 56;
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
            gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA8, 64, 64);
            gl.framebufferTexture2D(gl.DRAW_FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
            gl.disable(gl.SCISSOR_TEST);
            gl.enable(gl.CULL_FACE);
            gl.cullFace(gl.FRONT);
            gl.viewport(0, 0, 64, 64);
            gl.clearColor(0, 0, 0, 0);
            gl.clear(gl.COLOR_BUFFER_BIT);

            let models = Array(modelcount);
            let cursor = 36;
            for (let model = 0; model < modelcount; model += 1) {
                const vertexcount = arr.getUint32(cursor, true);
                let vertices = Array(vertexcount);
                const bufferDataArray = new ArrayBuffer(vertexcount * step);
                const bufferData = new DataView(bufferDataArray);
                const viewMatrix = new Float32Array(16);
                viewMatrix.set(new Float32Array(message, cursor + 4, 16));
                const projMatrix = new Float32Array(16);
                projMatrix.set(new Float32Array(message, cursor + 68, 16));
                cursor += 132;
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
                    bufferData.setFloat32(bufferDataOffset + 32, 64, true);
                    bufferData.setFloat32(bufferDataOffset + 36, 64, true);
                    bufferData.setFloat32(bufferDataOffset + 40, v.r, true);
                    bufferData.setFloat32(bufferDataOffset + 44, v.g, true);
                    bufferData.setFloat32(bufferDataOffset + 48, v.b, true);
                    bufferData.setFloat32(bufferDataOffset + 52, v.a, true);
                    vertices[vertex] = v;
                    cursor += 24;
                }
                models[model] = {
                    vertices,
                    viewMatrix,
                    projMatrix,
                };

                const buffer = gl.createBuffer();
                gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
                gl.bufferData(gl.ARRAY_BUFFER, bufferData, gl.STATIC_DRAW);
                gl.useProgram(program3d);
                gl.uniformMatrix4fv(program3d_uModelMatrix, false, identityMatrix);
                gl.uniformMatrix4fv(program3d_uViewMatrix, false, viewMatrix);
                gl.uniformMatrix4fv(program3d_uProjMatrix, false, projMatrix);
                gl.uniform2fv(program3d_uAtlasWH, [1, 1]);
                gl.bindTexture(gl.TEXTURE_2D, whitePixelTex);
                gl.uniform1i(program3d_uTex, 0); // because we activated TEXTURE0 earlier
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
            const buffer = gl.createBuffer();
            gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
            gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
                x1, y1, 0, 1, 0, 0, 64, 64, red, green, blue, alpha, 0, 0, 0,
                x2, y1, 1, 1, 0, 0, 64, 64, red, green, blue, alpha, 0, 0, 0,
                x1, y2, 0, 0, 0, 0, 64, 64, red, green, blue, alpha, 0, 0, 0,
                x2, y1, 1, 1, 0, 0, 64, 64, red, green, blue, alpha, 0, 0, 0,
                x2, y2, 1, 0, 0, 0, 64, 64, red, green, blue, alpha, 0, 0, 0,
                x1, y2, 0, 0, 0, 0, 64, 64, red, green, blue, alpha, 0, 0, 0,
            ]), gl.STATIC_DRAW);
            entities.push({
                type: 'itemicon',
                models,
                texture,
                buffer,
                targetWidth,
                targetHeight,
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
            gl.uniform1i(program2d_uTex, 0); // because we activated TEXTURE0 earlier
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
            const buffer = gl.createBuffer();
            gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
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
                buffer,
            });
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

    const vertexShader2d = gl.createShader(gl.VERTEX_SHADER);
    gl.shaderSource(vertexShader2d, vertexShaderSource2d);
    gl.compileShader(vertexShader2d);
    if (!gl.getShaderParameter(vertexShader2d, gl.COMPILE_STATUS)) {
        const log = gl.getShaderInfoLog(vertexShader2d);
        console.log(`vertex shader compilation error:\n${log}`);
        return;
    }

    const fragmentShader2d = gl.createShader(gl.FRAGMENT_SHADER);
    gl.shaderSource(fragmentShader2d, fragmentShaderSource2d);
    gl.compileShader(fragmentShader2d);
    if (!gl.getShaderParameter(fragmentShader2d, gl.COMPILE_STATUS)) {
        const log = gl.getShaderInfoLog(fragmentShader2d);
        console.log(`fragment shader compilation error:\n${log}`);
        return;
    }

    const vertexShader3d = gl.createShader(gl.VERTEX_SHADER);
    gl.shaderSource(vertexShader3d, vertexShaderSource3d);
    gl.compileShader(vertexShader3d);
    if (!gl.getShaderParameter(vertexShader3d, gl.COMPILE_STATUS)) {
        const log = gl.getShaderInfoLog(vertexShader3d);
        console.log(`vertex shader compilation error:\n${log}`);
        return;
    }

    const vertexShaderAnim3d = gl.createShader(gl.VERTEX_SHADER);
    gl.shaderSource(vertexShaderAnim3d, vertexShaderSourceAnim3d);
    gl.compileShader(vertexShaderAnim3d);
    if (!gl.getShaderParameter(vertexShaderAnim3d, gl.COMPILE_STATUS)) {
        const log = gl.getShaderInfoLog(vertexShaderAnim3d);
        console.log(`vertex anim shader compilation error:\n${log}`);
        return;
    }

    const fragmentShader3d = gl.createShader(gl.FRAGMENT_SHADER);
    gl.shaderSource(fragmentShader3d, fragmentShaderSource3d);
    gl.compileShader(fragmentShader3d);
    if (!gl.getShaderParameter(fragmentShader3d, gl.COMPILE_STATUS)) {
        const log = gl.getShaderInfoLog(fragmentShader3d);
        console.log(`fragment shader compilation error:\n${log}`);
        return;
    }

    program2d = gl.createProgram();
    gl.attachShader(program2d, vertexShader2d);
    gl.attachShader(program2d, fragmentShader2d);
    gl.linkProgram(program2d);
    gl.detachShader(program2d, vertexShader2d);
    gl.detachShader(program2d, fragmentShader2d);
    program2d_uAtlasWHScreenWH = gl.getUniformLocation(program2d, 'atlas_wh_screen_wh');
    program2d_uTex = gl.getUniformLocation(program2d, 'tex');

    program3d = gl.createProgram();
    gl.attachShader(program3d, vertexShader3d);
    gl.attachShader(program3d, fragmentShader3d);
    gl.linkProgram(program3d);
    gl.detachShader(program3d, vertexShader3d);
    gl.detachShader(program3d, fragmentShader3d);
    program3d_uModelMatrix = gl.getUniformLocation(program3d, 'modelmatrix');
    program3d_uViewMatrix = gl.getUniformLocation(program3d, 'viewmatrix');
    program3d_uProjMatrix = gl.getUniformLocation(program3d, 'projmatrix');
    program3d_uAtlasWH = gl.getUniformLocation(program3d, 'atlas_wh');
    program3d_uTex = gl.getUniformLocation(program3d, 'tex');

    programAnim3d = gl.createProgram();
    gl.attachShader(programAnim3d, vertexShaderAnim3d);
    gl.attachShader(programAnim3d, fragmentShader3d);
    gl.linkProgram(programAnim3d);
    gl.detachShader(programAnim3d, vertexShaderAnim3d);
    gl.detachShader(programAnim3d, fragmentShader3d);
    programAnim3d_uModelMatrix = gl.getUniformLocation(programAnim3d, 'modelmatrix');
    programAnim3d_uViewMatrix = gl.getUniformLocation(programAnim3d, 'viewmatrix');
    programAnim3d_uProjMatrix = gl.getUniformLocation(programAnim3d, 'projmatrix');
    programAnim3d_uAtlasWH = gl.getUniformLocation(programAnim3d, 'atlas_wh');
    programAnim3d_uTex = gl.getUniformLocation(programAnim3d, 'tex');

    gl.deleteShader(vertexShader2d);
    gl.deleteShader(fragmentShader2d);
    gl.deleteShader(vertexShader3d);
    gl.deleteShader(fragmentShader3d);
    gl.deleteShader(vertexShaderAnim3d);
    
    gl.activeTexture(gl.TEXTURE0);
    gl.enable(gl.SCISSOR_TEST);
    gl.disable(gl.CULL_FACE);
    gl.disable(gl.DEPTH_TEST);
    gl.enable(gl.BLEND);
    gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.blendEquationSeparate(gl.FUNC_ADD, gl.FUNC_ADD);
    gl.depthFunc(gl.LEQUAL);

    for (i in pending) {
        handleMessage(pending[i]);
    }
    pending = [];

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
