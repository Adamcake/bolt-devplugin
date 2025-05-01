<script lang="ts">
  import type { ModelVertexData } from "./interfaces";

  export let vertex: ModelVertexData;
</script>

<div class="ml-4 w-full">
  model: {vertex.modelpoint.x},{vertex.modelpoint.y},{vertex.modelpoint.z}
  <br />
  rgb: {vertex.r.toPrecision(4)}, {vertex.g.toPrecision(4)}, {vertex.b.toPrecision(
    4,
  )}
  <br />
  alpha: {vertex.a.toPrecision(4)}
  <br />
</div>
