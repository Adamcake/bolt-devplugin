<script lang="ts">
  import {
    vertexShaderSource2d,
    fragmentShaderSource2d,
    vertexShaderSource3d,
    vertexShaderSourceAnim3d,
    fragmentShaderSource3d,
    vertexShaderSourceParticles,
    compileShader,
    linkProgram,
    batch2dAttribs,
    render3dAttribs,
    render3dAnimAttribs,
    renderParticlesAttribs,
    vertexShaderSourceCheckers,
    fragmentShaderSourceCheckers,
    renderCheckersAttribs,
  } from "./shaders";
  import type { Buffer, Model, MenuData } from "./interfaces";
  import Menu from "./Menu.svelte";
  import { v4 as randomUUID } from "uuid";

  let menuData: MenuData = {
    textures: {},
    entities: [],
    selectedTexture: null,
    selectedTextureId: "",
    redraw: () => redraw(canvas!, gl!),
  };

  const getNumberParam = (s: string): number => {
    const str: string | null = params.get(s);
    return str ? parseInt(str) : 0;
  };

  const makeProjMatrix = (
    width: number,
    height: number,
    near: number,
    far: number,
    fov: number,
  ) => {
    // https://www.songho.ca/opengl/gl_projectionmatrix.html
    // the view matrix given to us by the game is slightly incorrect in that it projects the world into the positive
    // z-axis instead of the negative, so to compensate for this, the third row of this matrix is negated from what you
    // might find in a normal projection matrix. this matrix is also row-major whereas the article linked above uses
    // column-major notation.
    return new Float32Array([
      near / (width * fov),
      0.0,
      0.0,
      0.0,
      0.0,
      near / (height * fov),
      0.0,
      0.0,
      0.0,
      0.0,
      (far + near) / (far - near),
      1.0,
      0.0,
      0.0,
      (-2 * far * near) / (far - near),
      0.0,
    ]);
  };

  const identityMatrix = new Float32Array([
    1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1,
  ]);

  const textureUnitID = 0;

  let program2d: WebGLProgram | null = null;
  let program2d_uAtlasWHScreenWH: WebGLUniformLocation | null = null;
  let program2d_uTex: WebGLUniformLocation | null = null;

  let program3d: WebGLProgram | null = null;
  let program3d_uModelMatrix: WebGLUniformLocation | null = null;
  let program3d_uViewMatrix: WebGLUniformLocation | null = null;
  let program3d_uProjMatrix: WebGLUniformLocation | null = null;
  let program3d_uAtlasWH: WebGLUniformLocation | null = null;
  let program3d_uTex: WebGLUniformLocation | null = null;

  let programAnim3d: WebGLProgram | null = null;
  let programAnim3d_uModelMatrix: WebGLUniformLocation | null = null;
  let programAnim3d_uViewMatrix: WebGLUniformLocation | null = null;
  let programAnim3d_uProjMatrix: WebGLUniformLocation | null = null;
  let programAnim3d_uAtlasWH: WebGLUniformLocation | null = null;
  let programAnim3d_uTex: WebGLUniformLocation | null = null;

  let programParticles: WebGLProgram | null = null;
  let programParticles_uViewMatrix: WebGLUniformLocation | null = null;
  let programParticles_uProjMatrix: WebGLUniformLocation | null = null;
  let programParticles_uTex: WebGLUniformLocation | null = null;
  let programParticles_uAtlasWH: WebGLUniformLocation | null = null;

  let programCheckers: WebGLProgram | null = null;
  let programCheckers_uScreenWH: WebGLUniformLocation | null = null;

  let checkersBuffer: Buffer | null = null;

  const params = new URLSearchParams(window.location.search);
  const n = params.get("n");
  const estimatedVertices: number = n ? Math.max(parseInt(n), 1) : 1;
  const windoww: number = getNumberParam("w");
  const windowh: number = getNumberParam("h");
  const gvx: number = getNumberParam("gx");
  const gvy: number = getNumberParam("gy");
  const gvw: number = getNumberParam("gw");
  const gvh: number = getNumberParam("gh");

  let receivedVertices: number = 0;
  let maxAttribCount: number = 0;
  let whitePixelTex: WebGLTexture;
  let minimaptex: WebGLTexture | null = null;
  let minimapfb: WebGLFramebuffer | null = null;
  let minimapWidth: number = 0;
  let minimapHeight: number = 0;
  let projMatrix = makeProjMatrix(gvw, gvh, 460, 65536 + 1024, 5 / 16);
  let done: boolean = false;
  let showMenu: boolean = false;

  let canvas: HTMLCanvasElement | null = null;
  let gl: WebGL2RenderingContext | null = null;
  $: if (canvas) {
    canvas.width = windoww;
    canvas.height = windowh;
    gl = canvas.getContext("webgl2");
    if (gl) {
      maxAttribCount = gl.getParameter(gl.MAX_VERTEX_ATTRIBS);

      whitePixelTex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, whitePixelTex);
      const texData = new Uint8Array([0xff, 0xff, 0xff, 0xff]);
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA,
        1,
        1,
        0,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        texData,
      );

      const vertexShader2d = compileShader(
        gl,
        gl.VERTEX_SHADER,
        vertexShaderSource2d,
        "2D vertex shader",
      );
      const fragmentShader2d = compileShader(
        gl,
        gl.FRAGMENT_SHADER,
        fragmentShaderSource2d,
        "2D fragment shader",
      );
      const vertexShader3d = compileShader(
        gl,
        gl.VERTEX_SHADER,
        vertexShaderSource3d,
        "3D vertex shader",
      );
      const vertexShaderAnim3d = compileShader(
        gl,
        gl.VERTEX_SHADER,
        vertexShaderSourceAnim3d,
        "3D anim vertex shader",
      );
      const fragmentShader3d = compileShader(
        gl,
        gl.FRAGMENT_SHADER,
        fragmentShaderSource3d,
        "3D fragment shader",
      );
      const vertexShaderParticles = compileShader(
        gl,
        gl.VERTEX_SHADER,
        vertexShaderSourceParticles,
        "particle vertex shader",
      );
      const vertexShaderCheckers = compileShader(
        gl,
        gl.VERTEX_SHADER,
        vertexShaderSourceCheckers,
        "checkers vertex shader",
      );
      const fragmentShaderCheckers = compileShader(
        gl,
        gl.FRAGMENT_SHADER,
        fragmentShaderSourceCheckers,
        "checkers fragment shader",
      );

      program2d = linkProgram(
        gl,
        vertexShader2d,
        fragmentShader2d,
        "2D program",
      );
      program2d_uAtlasWHScreenWH = gl.getUniformLocation(
        program2d,
        "atlas_wh_screen_wh",
      );
      program2d_uTex = gl.getUniformLocation(program2d, "tex");

      program3d = linkProgram(
        gl,
        vertexShader3d,
        fragmentShader3d,
        "3D program",
      );
      program3d_uModelMatrix = gl.getUniformLocation(program3d, "modelmatrix");
      program3d_uViewMatrix = gl.getUniformLocation(program3d, "viewmatrix");
      program3d_uProjMatrix = gl.getUniformLocation(program3d, "projmatrix");
      program3d_uAtlasWH = gl.getUniformLocation(program3d, "atlas_wh");
      program3d_uTex = gl.getUniformLocation(program3d, "tex");

      programAnim3d = linkProgram(
        gl,
        vertexShaderAnim3d,
        fragmentShader3d,
        "3D animated program",
      );
      programAnim3d_uModelMatrix = gl.getUniformLocation(
        programAnim3d,
        "modelmatrix",
      );
      programAnim3d_uViewMatrix = gl.getUniformLocation(
        programAnim3d,
        "viewmatrix",
      );
      programAnim3d_uProjMatrix = gl.getUniformLocation(
        programAnim3d,
        "projmatrix",
      );
      programAnim3d_uAtlasWH = gl.getUniformLocation(programAnim3d, "atlas_wh");
      programAnim3d_uTex = gl.getUniformLocation(programAnim3d, "tex");

      programParticles = linkProgram(
        gl,
        vertexShaderParticles,
        fragmentShader3d,
        "Particles program",
      );
      programParticles_uViewMatrix = gl.getUniformLocation(
        programParticles,
        "viewmatrix",
      );
      programParticles_uProjMatrix = gl.getUniformLocation(
        programParticles,
        "projmatrix",
      );
      programParticles_uTex = gl.getUniformLocation(programParticles, "tex");
      programParticles_uAtlasWH = gl.getUniformLocation(
        programParticles,
        "atlas_wh",
      );

      programCheckers = linkProgram(
        gl,
        vertexShaderCheckers,
        fragmentShaderCheckers,
        "Checkers program",
      );
      programCheckers_uScreenWH = gl.getUniformLocation(
        programCheckers,
        "screen_wh",
      );

      gl.deleteShader(vertexShader2d);
      gl.deleteShader(fragmentShader2d);
      gl.deleteShader(vertexShader3d);
      gl.deleteShader(fragmentShader3d);
      gl.deleteShader(vertexShaderAnim3d);
      gl.deleteShader(vertexShaderParticles);
      gl.deleteShader(vertexShaderCheckers);
      gl.deleteShader(fragmentShaderCheckers);

      gl.activeTexture(gl.TEXTURE0 + textureUnitID);
      gl.enable(gl.SCISSOR_TEST);
      gl.disable(gl.CULL_FACE);
      gl.disable(gl.DEPTH_TEST);
      gl.enable(gl.BLEND);
      gl.blendEquationSeparate(gl.FUNC_ADD, gl.FUNC_ADD);
      gl.depthFunc(gl.LEQUAL);

      redraw(canvas, gl);
    }
  }

  const drawArraysFromEntityBuffer = (
    gl: WebGL2RenderingContext,
    buffer: Buffer,
    vertexCount: number,
    enabledList?: boolean[],
  ) => {
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer.vbo);
    for (let i = 0; i < maxAttribCount; i += 1) {
      const attrib = buffer.attribs[i];
      if (!attrib) {
        gl.disableVertexAttribArray(i);
        continue;
      }
      gl.enableVertexAttribArray(i);
      gl.vertexAttribPointer(
        i,
        attrib.count,
        gl.FLOAT,
        false,
        buffer.step,
        attrib.offset,
      );
    }

    // there's no list of enabled vertices, so draw all of them
    if (!enabledList) {
      gl.drawArrays(gl.TRIANGLES, 0, vertexCount);
      return;
    }

    // only draw the enabled vertices
    let nextStart: number | null = null;
    for (let i = 0; i < vertexCount; i += 1) {
      const enabled = enabledList[i];
      if (nextStart === null) {
        if (enabled) {
          nextStart = i;
        }
      } else if (!enabled) {
        gl.drawArrays(gl.TRIANGLES, nextStart, i - nextStart);
        nextStart = null;
      }
    }
    if (nextStart !== null) {
      gl.drawArrays(gl.TRIANGLES, nextStart, vertexCount - nextStart);
    }
  };

  const redraw = (canvas: HTMLCanvasElement, gl: WebGL2RenderingContext) => {
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.scissor(0, 0, canvas.width, canvas.height);
    gl.clearColor(0.0, 0.0, 0.0, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    if (!done) {
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
      if (
        canvas.width <= barDoubleThickness ||
        canvas.height <= barDoubleThickness
      )
        return;
      gl.scissor(
        barThickness,
        barThickness,
        canvas.width - barDoubleThickness,
        canvas.height - barDoubleThickness,
      );
      clearBackground();
      gl.scissor(
        canvas.width / 2 - (barInnerWidth / 2 + barThickness),
        canvas.height / 2 - (barInnerHeight / 2 + barThickness),
        barInnerWidth + barDoubleThickness,
        barInnerHeight + barDoubleThickness,
      );
      clearForeground();
      gl.scissor(
        canvas.width / 2 - barInnerWidth / 2 + barProgressWidth,
        canvas.height / 2 - barInnerHeight / 2,
        barInnerWidth - barProgressWidth,
        barInnerHeight,
      );
      clearBackground();
      return;
    }

    if (menuData.selectedTexture) {
      gl.useProgram(programCheckers);
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.uniform2fv(programCheckers_uScreenWH, [canvas.width, canvas.height]);
      if (!checkersBuffer) {
        const vbo1 = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, vbo1);
        gl.bufferData(
          gl.ARRAY_BUFFER,
          // prettier-ignore
          new Float32Array([0,0,1,0,0,1,1,0,1,1,0,1]),
          gl.STATIC_DRAW,
        );
        checkersBuffer = {
          vbo: vbo1,
          step: 8,
          attribs: renderCheckersAttribs,
        };
      }
      drawArraysFromEntityBuffer(gl, checkersBuffer, 6);

      const tex = menuData.selectedTexture;
      const screenRatio = canvas.width / canvas.height;
      const imageRatio = tex.width / tex.height;
      const fullHeight = screenRatio >= imageRatio;
      const targetWidth = fullHeight
        ? (tex.width * canvas.height) / tex.height
        : canvas.width;
      const targetHeight = fullHeight
        ? canvas.height
        : (tex.height * canvas.width) / tex.width;
      const x1 = fullHeight ? (canvas.width - canvas.height) / 2 : 0;
      const x2 = targetWidth + x1;
      const y1 = fullHeight ? 0 : (canvas.height - canvas.width) / 2;
      const y2 = targetHeight + y1;

      gl.blendFuncSeparate(
        gl.SRC_ALPHA,
        gl.ONE_MINUS_SRC_ALPHA,
        gl.ONE,
        gl.ONE_MINUS_SRC_ALPHA,
      );
      gl.disable(gl.DEPTH_TEST);
      gl.useProgram(program2d);
      gl.uniform4fv(program2d_uAtlasWHScreenWH, [
        tex.width,
        tex.height,
        canvas.width,
        canvas.height,
      ]);
      gl.bindTexture(gl.TEXTURE_2D, tex.texture);
      gl.uniform1i(program2d_uTex, textureUnitID);
      const vbo = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
      gl.bufferData(
        gl.ARRAY_BUFFER,
        // prettier-ignore
        new Float32Array([x1,y1,0,0,0,0,tex.width,tex.height,1,1,1,1,0,0,0,x2,y1,1,0,0,0,tex.width,tex.height,1,1,1,1,0,0,0,x1,y2,0,1,0,0,tex.width,tex.height,1,1,1,1,0,0,0,x2,y1,1,0,0,0,tex.width,tex.height,1,1,1,1,0,0,0,x2,y2,1,1,0,0,tex.width,tex.height,1,1,1,1,0,0,0,x1,y2,0,1,0,0,tex.width,tex.height,1,1,1,1,0,0,0]),
        gl.STATIC_DRAW,
      );
      const buffer: Buffer = {
        vbo,
        step: 60,
        attribs: batch2dAttribs,
      };
      drawArraysFromEntityBuffer(gl, buffer, 6);
      gl.deleteBuffer(vbo);
      return;
    }

    if (minimapfb) {
      gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, minimapfb);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, null);
    }

    gl.disable(gl.SCISSOR_TEST);
    for (let entity of menuData.entities) {
      if (!entity.enabled) continue;
      if (entity.type === "batch2d") {
        gl.blendFuncSeparate(
          gl.SRC_ALPHA,
          gl.ONE_MINUS_SRC_ALPHA,
          gl.ONE,
          gl.ONE_MINUS_SRC_ALPHA,
        );
        gl.disable(gl.DEPTH_TEST);
        const tex = menuData.textures[entity.textureId!];
        gl.useProgram(program2d);
        gl.viewport(0, 0, windoww, windowh);
        gl.uniform4fv(program2d_uAtlasWHScreenWH, [
          tex.width,
          tex.height,
          entity.targetWidth!,
          entity.targetHeight!,
        ]);
        gl.bindTexture(gl.TEXTURE_2D, tex.texture);
        gl.uniform1i(program2d_uTex, textureUnitID);
        drawArraysFromEntityBuffer(
          gl,
          entity.buffer!,
          entity.vertexCount!,
          entity.enabledVerticesList,
        );
      }

      if (entity.type === "render3d") {
        gl.blendFuncSeparate(
          gl.SRC_ALPHA,
          gl.ONE_MINUS_SRC_ALPHA,
          gl.ONE,
          gl.ONE_MINUS_SRC_ALPHA,
        );
        gl.enable(gl.DEPTH_TEST);
        const tex = menuData.textures[entity.textureId!];
        gl.useProgram(entity.animated ? programAnim3d : program3d);
        gl.viewport(gvx, gvy, gvw, gvh);
        gl.uniformMatrix4fv(
          entity.animated ? programAnim3d_uModelMatrix : program3d_uModelMatrix,
          false,
          entity.modelMatrix!,
        );
        gl.uniformMatrix4fv(
          entity.animated ? programAnim3d_uViewMatrix : program3d_uViewMatrix,
          false,
          entity.viewMatrix!,
        );
        gl.uniformMatrix4fv(
          entity.animated ? programAnim3d_uProjMatrix : program3d_uProjMatrix,
          false,
          projMatrix,
        );
        gl.uniform2fv(
          entity.animated ? programAnim3d_uAtlasWH : program3d_uAtlasWH,
          [tex.width, tex.height],
        );
        gl.bindTexture(gl.TEXTURE_2D, tex.texture);
        gl.uniform1i(
          entity.animated ? programAnim3d_uTex : program3d_uTex,
          textureUnitID,
        );
        drawArraysFromEntityBuffer(gl, entity.buffer!, entity.vertexCount!);
      }

      if (entity.type === "renderparticles") {
        gl.blendFuncSeparate(
          gl.ONE,
          gl.ONE_MINUS_SRC_ALPHA,
          gl.ONE,
          gl.ONE_MINUS_SRC_ALPHA,
        );
        gl.enable(gl.DEPTH_TEST);
        const tex = menuData.textures[entity.textureId!];
        gl.useProgram(programParticles);
        gl.viewport(gvx, gvy, gvw, gvh);
        gl.uniformMatrix4fv(
          programParticles_uViewMatrix,
          false,
          entity.viewMatrix!,
        );
        gl.uniformMatrix4fv(programParticles_uProjMatrix, false, projMatrix);
        gl.uniform2fv(programParticles_uAtlasWH, [tex.width, tex.height]);
        gl.bindTexture(gl.TEXTURE_2D, tex.texture);
        gl.uniform1i(programParticles_uTex, textureUnitID);
        drawArraysFromEntityBuffer(gl, entity.buffer!, entity.vertexCount!);
      }

      if (entity.type === "icon" || entity.type === "bigicon") {
        const texSize: GLfloat = entity.texSize!;
        gl.blendFuncSeparate(
          gl.SRC_ALPHA,
          gl.ONE_MINUS_SRC_ALPHA,
          gl.ONE,
          gl.ONE_MINUS_SRC_ALPHA,
        );
        gl.disable(gl.DEPTH_TEST);
        gl.useProgram(program2d);
        gl.viewport(0, 0, windoww, windowh);
        gl.bindTexture(gl.TEXTURE_2D, entity.texture!);
        gl.uniform1i(program2d_uTex, textureUnitID);
        gl.uniform4fv(program2d_uAtlasWHScreenWH, [
          texSize,
          texSize,
          entity.targetWidth!,
          entity.targetHeight!,
        ]);
        drawArraysFromEntityBuffer(gl, entity.buffer!, 6);
      }

      if (entity.type === "minimap2d") {
        if (!minimaptex || !minimapfb) {
          minimaptex = gl.createTexture();
          gl.bindTexture(gl.TEXTURE_2D, minimaptex);
          gl.texStorage2D(
            gl.TEXTURE_2D,
            1,
            gl.RGBA8,
            minimapWidth,
            minimapHeight,
          );
          minimapfb = gl.createFramebuffer();
          gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, minimapfb);
          gl.framebufferTexture2D(
            gl.DRAW_FRAMEBUFFER,
            gl.COLOR_ATTACHMENT0,
            gl.TEXTURE_2D,
            minimaptex,
            0,
          );
        } else {
          gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, minimapfb);
        }

        gl.viewport(0, 0, minimapWidth, minimapHeight);
        gl.disable(gl.DEPTH_TEST);
        const tex = menuData.textures[entity.textureId!];
        gl.useProgram(program2d);
        gl.uniform4fv(program2d_uAtlasWHScreenWH, [
          tex.width,
          tex.height,
          minimapWidth,
          minimapHeight,
        ]);
        gl.bindTexture(gl.TEXTURE_2D, tex.texture);
        gl.bindBuffer(gl.ARRAY_BUFFER, entity.vbo!);
        gl.uniform1i(program2d_uTex, textureUnitID);
        for (let i = 0; i < maxAttribCount; i += 1) {
          i < 4
            ? gl.enableVertexAttribArray(i)
            : gl.disableVertexAttribArray(i);
        }
        gl.vertexAttribPointer(0, 4, gl.FLOAT, false, 60, 0);
        gl.vertexAttribPointer(1, 4, gl.FLOAT, false, 60, 16);
        gl.vertexAttribPointer(2, 4, gl.FLOAT, false, 60, 32);
        gl.vertexAttribPointer(3, 3, gl.FLOAT, false, 60, 48);
        gl.drawArrays(gl.TRIANGLES, 0, entity.vertices!.length);
        gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, null);
      }

      if (entity.type === "minimap") {
        if (minimaptex === null) continue;
        gl.blendFuncSeparate(
          gl.SRC_ALPHA,
          gl.ONE_MINUS_SRC_ALPHA,
          gl.ONE,
          gl.ONE_MINUS_SRC_ALPHA,
        );
        gl.disable(gl.DEPTH_TEST);
        gl.useProgram(program2d);
        gl.viewport(0, 0, windoww, windowh);

        gl.uniform4fv(program2d_uAtlasWHScreenWH, [
          minimapWidth,
          minimapHeight,
          entity.targetWidth!,
          entity.targetHeight!,
        ]);
        gl.bindTexture(gl.TEXTURE_2D, minimaptex);
        gl.uniform1i(program2d_uTex, textureUnitID);
        drawArraysFromEntityBuffer(gl, entity.buffer!, 6);
      }
    }
  };

  const handleMessage = (
    canvas: HTMLCanvasElement,
    gl: WebGL2RenderingContext,
    message: ArrayBuffer,
  ) => {
    const arr = new DataView(message);
    const msgtype = arr.getUint32(0, true);
    switch (msgtype) {
      case 0: {
        done = true;
        redraw(canvas, gl);
        break;
      }
      case 1: {
        const textureid = arr.getUint32(4, true);
        const width = arr.getUint32(8, true);
        const height = arr.getUint32(12, true);
        const texture = gl.createTexture();
        const data = new Uint8Array(message, 16, width * height * 4);
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texImage2D(
          gl.TEXTURE_2D,
          0,
          gl.RGBA,
          width,
          height,
          0,
          gl.RGBA,
          gl.UNSIGNED_BYTE,
          data,
        );
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        menuData.textures[textureid] = {
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
            anim.set(
              new Float32Array(message, 144 + vertexMsgSize * i + 40, 16),
            );
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
          if (anim) {
            for (let j = 0; j < 16; j += 1) {
              bufferData.setFloat32(dstOffset + 56 + j * 4, anim[j], true);
            }
          }
        }

        const vbo = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
        gl.bufferData(gl.ARRAY_BUFFER, bufferData, gl.STATIC_DRAW);
        menuData.entities.push({
          type: "render3d",
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
          enabled: true,
          expanded: false,
          uuid: randomUUID(),
        });
        receivedVertices += vertexCount;
        redraw(canvas, gl);
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
        menuData.entities.push({
          type: "batch2d",
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
          enabled: true,
          expanded: false,
          uuid: randomUUID(),
          enabledVerticesList: Array(Math.floor(vertexCount)).fill(true),
        });
        receivedVertices += vertexCount;
        redraw(canvas, gl);
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
        gl.framebufferTexture2D(
          gl.DRAW_FRAMEBUFFER,
          gl.COLOR_ATTACHMENT0,
          gl.TEXTURE_2D,
          texture,
          0,
        );
        gl.enable(gl.CULL_FACE);
        gl.cullFace(gl.FRONT);
        gl.viewport(0, 0, texSize, texSize);
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);

        let models: Model[] = Array(modelcount);
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
            i < 4
              ? gl.enableVertexAttribArray(i)
              : gl.disableVertexAttribArray(i);
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
        gl.bufferData(
          gl.ARRAY_BUFFER,
          // prettier-ignore
          new Float32Array([x1,y1,0,1,0,0,texSize,texSize,red,green,blue,alpha,0,0,0,x2,y1,1,1,0,0,texSize,texSize,red,green,blue,alpha,0,0,0,x1,y2,0,0,0,0,texSize,texSize,red,green,blue,alpha,0,0,0,x2,y1,1,1,0,0,texSize,texSize,red,green,blue,alpha,0,0,0,x2,y2,1,0,0,0,texSize,texSize,red,green,blue,alpha,0,0,0,x1,y2,0,0,0,0,texSize,texSize,red,green,blue,alpha,0,0,0]),
          gl.STATIC_DRAW,
        );
        menuData.entities.push({
          type: msgtype === 5 ? "icon" : "bigicon",
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
          enabled: true,
          expanded: false,
          uuid: randomUUID(),
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

        menuData.entities.push({
          type: "minimap2d",
          textureId,
          vbo,
          vertices,
          enabled: true,
          expanded: false,
          uuid: randomUUID(),
        });
        receivedVertices += vertexCount;
        redraw(canvas, gl);
        break;
      }
      case 7: {
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
        gl.bufferData(
          gl.ARRAY_BUFFER,
          // prettier-ignore
          new Float32Array([x1,y1,u1,v2,sourcex,sourcey,sourcew,sourceh,1,1,1,1,0,0,0,x2,y1,u2,v2,sourcex,sourcey,sourcew,sourceh,1,1,1,1,0,0,0,x1,y2,u1,v1,sourcex,sourcey,sourcew,sourceh,1,1,1,1,0,0,0,x2,y1,u2,v2,sourcex,sourcey,sourcew,sourceh,1,1,1,1,0,0,0,x2,y2,u2,v1,sourcex,sourcey,sourcew,sourceh,1,1,1,1,0,0,0,x1,y2,u1,v1,sourcex,sourcey,sourcew,sourceh,1,1,1,1,0,0,0]),
          gl.STATIC_DRAW,
        );
        menuData.entities.push({
          type: "minimap",
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
          enabled: true,
          expanded: false,
          uuid: randomUUID(),
        });
        redraw(canvas, gl);
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
        menuData.entities.push({
          type: "renderparticles",
          textureId,
          vertexCount,
          vertices,
          viewMatrix,
          buffer: {
            vbo,
            step: vertexBufferSize,
            attribs: renderParticlesAttribs,
          },
          enabled: true,
          expanded: false,
          uuid: randomUUID(),
        });
        receivedVertices += vertexCount;
        redraw(canvas, gl);
        break;
      }
    }
  };

  window.addEventListener("message", async (event) => {
    if (typeof event.data !== "object") return;

    if (event.data.type === "pluginMessage") {
      if (typeof event.data.content !== "object") return;
      if (!canvas || !gl) return;
      handleMessage(canvas, gl, event.data.content);
    }
  });
</script>

<canvas bind:this={canvas} class="absolute right-0"></canvas>
{#if showMenu}
  <div
    class="overflow-auto absolute w-56 h-full left-0 top-0 m-0 p-0 bg-slate-200"
  >
    <Menu bind:data={menuData} />
  </div>
  <input
    type="image"
    src="plugin://app/images/bars-solid.svg"
    class="absolute rounded-sm mx-61 my-6 p-1 w-9 h-9 bg-gray-200 opacity-75 hover:opacity-100"
    alt="hide menu"
    onclick={() => (showMenu = false)}
  />
{:else if done}
  <input
    type="image"
    src="plugin://app/images/bars-solid.svg"
    class="absolute rounded-sm m-6 p-1 w-9 h-9 bg-gray-200 opacity-75 hover:opacity-100"
    alt="show menu"
    onclick={() => (showMenu = true)}
  />
{/if}

{#if menuData.selectedTexture}
  <input
    type="image"
    src="plugin://app/images/xmark-solid.svg"
    class="absolute right-0 rounded-sm m-4 p-1 w-8 h-8 bg-gray-200 opacity-75 hover:opacity-100"
    alt="close"
    onclick={() => {
      menuData.selectedTexture = null;
      redraw(canvas!, gl!);
    }}
  />
{/if}
