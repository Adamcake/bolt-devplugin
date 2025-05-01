<script lang="ts">
  import type { ModelVertexData } from "./interfaces";
  import { roundTo255 } from "./functions";

  export let vertex: ModelVertexData;
</script>

<div class="ml-2 w-full">
  model: {vertex.modelpoint.x},{vertex.modelpoint.y},{vertex.modelpoint.z}
  <br />
  rgb: {roundTo255(vertex.r)}, {roundTo255(vertex.g)}, {roundTo255(vertex.b)}
  <br />
  alpha: {vertex.a.toPrecision(4)}
  <br />
</div>
