const vertexShaderSource3d = `#version 330 core
in ivec3 pos;
uniform mat4 animmatrix;
uniform mat4 modelmatrix;
uniform mat4 viewprojmatrix;
void main() {
    gl_Position = vec4(pos, 1.0) * animmatrix * modelmatrix * viewprojmatrix;
}
`;

const fragmentShaderSource3d = `#version 330 core
in vec4 rgba;
in vec2 uv;
layout (location = 0) out vec4 col;
uniform sampler2D tex;
void main() {
    col = texture(tex, uv) * rgba;
}
`;

const params = new URLSearchParams(window.location.search);
const n = params.get('n');
const estimatedVertices = n ? Math.max(parseInt(n), 1) : 1;
let receivedVertices = 0;
let done = false;
let pending = [];

let entities = [];

let gl = null;
let canvas = null;

const redraw = () => {
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.scissor(0, 0, canvas.width, canvas.height);
    gl.clearColor(0.0, 0.0, 0.0, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    
    if (done) {
        // TODO: render something useful...
    } else {
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
    const msgtype = arr.getInt32(0, true);
    switch (msgtype) {
        case 0:
            done = true;
            redraw();
            break;
        case 1:
        case 2:
            animated = msgtype === 2;
            const vertexCount = arr.getInt32(4, true);
            const imageCount = arr.getInt32(8, true);
            const animationCount = arr.getInt32(12, true);
            // TODO: process 3D model, add to entities
            receivedVertices += vertexCount;
            redraw();
            break;
    }
};

window.addEventListener('DOMContentLoaded', () => {
    canvas = document.createElement("canvas");
    gl = canvas.getContext("webgl");

    const vertexShader3d = gl.createShader(gl.VERTEX_SHADER);
    gl.shaderSource(vertexShader3d, vertexShaderSource3d);
    gl.compileShader(vertexShader3d);
    const fragmentShader3d = gl.createShader(gl.FRAGMENT_SHADER);
    gl.shaderSource(fragmentShader3d, fragmentShaderSource3d);
    gl.compileShader(fragmentShader3d);
    const program3d = gl.createProgram();
    gl.attachShader(program3d, vertexShader3d);
    gl.attachShader(program3d, fragmentShader3d);
    gl.linkProgram(program3d);
    gl.detachShader(program3d, vertexShader3d);
    gl.detachShader(program3d, fragmentShader3d);
    gl.deleteShader(vertexShader3d);
    gl.deleteShader(fragmentShader3d);

    gl.enable(gl.SCISSOR_TEST);
    gl.enable(gl.CULL_FACE);
    gl.disable(gl.DEPTH_TEST);

    for (i in pending) {
        handleMessage(pending[i]);
    }
    pending = [];

    const onresize = () => {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        redraw();
    };
    document.body.appendChild(canvas);
    window.addEventListener("resize", onresize);
    onresize();
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
