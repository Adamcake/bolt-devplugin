<script lang="ts">
  import type { Image2D } from "./interfaces";

  export let image: Image2D;
</script>

<div class="ml-4 w-full">
  screen: {image.x},{image.y}
  {image.w}x{image.h}
  <br />
  atlas: {image.ax},{image.ay}
  {image.aw}x{image.ah}
  <br />
  rgb: {image.r.toPrecision(4)}, {image.g.toPrecision(4)}, {image.b.toPrecision(
    4,
  )}
  <br />
  alpha: {image.a.toPrecision(4)}
  <br />
</div>
