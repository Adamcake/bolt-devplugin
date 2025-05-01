<script lang="ts">
  import type { VertexData3D } from "./interfaces";
  import { roundTo255 } from "./functions";

  export let vertex: VertexData3D;
</script>

<div class="ml-2 w-full">
  {#if vertex.modelpoint}
    model: {vertex.modelpoint.x},{vertex.modelpoint.y},{vertex.modelpoint.z}
    <br />
  {/if}
  atlas: {vertex.ax},{vertex.ay}
  {vertex.aw}x{vertex.ah}
  <br />
  uv: {vertex.u.toPrecision(4)}, {vertex.v.toPrecision(4)}
  <br />
  rgb: {roundTo255(vertex.r)}, {roundTo255(vertex.g)}, {roundTo255(vertex.b)}
  <br />
  alpha: {vertex.a.toPrecision(4)}
  <br />
</div>
