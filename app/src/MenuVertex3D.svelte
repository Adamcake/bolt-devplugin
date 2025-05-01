<script lang="ts">
  import type { VertexData3D } from "./interfaces";

  export let vertex: VertexData3D;
</script>

<div class="ml-4 w-full">
  {#if vertex.modelpoint}
    model: {vertex.modelpoint.x},{vertex.modelpoint.y},{vertex.modelpoint.z}
    <br />
  {/if}
  atlas: {vertex.ax},{vertex.ay}
  {vertex.aw}x{vertex.ah}
  <br />
  uv: {vertex.u.toPrecision(4)}, {vertex.v.toPrecision(4)}
  <br />
  rgb: {vertex.r.toPrecision(4)}, {vertex.g.toPrecision(4)}, {vertex.b.toPrecision(
    4,
  )}
  <br />
  alpha: {vertex.a.toPrecision(4)}
  <br />
</div>
