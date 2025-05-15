<script lang="ts">
  import type { ImageData2D } from "./interfaces";
  import { roundTo255 } from "./functions";

  export let image: ImageData2D;
  export let view: ((image: ImageData2D) => void) | null = null;
</script>

<div class="ml-2 w-full">
  {#if view}
    <button
      class="px-1 bg-gray-200 hover:bg-gray-100"
      onclick={() => view(image)}>view image</button
    >
    <br />
  {/if}
  screen: {image.x},{image.y}
  {image.w}x{image.h}
  <br />
  atlas: {image.ax},{image.ay}
  {image.aw}x{image.ah}
  <br />
  rgb: {roundTo255(image.r)}, {roundTo255(image.g)}, {roundTo255(image.b)}
  <br />
  alpha: {image.a.toPrecision(4)}
  <br />
</div>
