<script lang="ts">
  import type { Entity, MenuData, Image2D } from "./interfaces";
  import MenuCaret from "./MenuCaret.svelte";
  import MenuImage2D from "./MenuImage2D.svelte";
  export let entity: Entity;
  export let menuData: MenuData;

  const verticesPerImage = 6;
  const sublistMaxImageCount = 100;
  let expanded = false;

  interface ImageSublist {
    images: Image2D[];
    desc: string;
    expanded: boolean;
  }

  function isImageSublist(
    object: Image2D | ImageSublist,
  ): object is ImageSublist {
    return "images" in object;
  }

  let images2d: (Image2D | ImageSublist)[] | null = null;
  let image2dCount = 0;
  if (entity.type === "batch2d") {
    const vertices = entity.vertices!;
    const sublistMinimumImages = sublistMaxImageCount * 2;
    const useSublist =
      vertices.length >= sublistMinimumImages * verticesPerImage;
    images2d = [];
    let sublist: Image2D[] = [];
    for (
      let i = 0;
      i < vertices.length - (verticesPerImage - 1);
      i += verticesPerImage
    ) {
      const firstVertex = vertices[i];
      let x1: number = firstVertex.x;
      let x2: number = firstVertex.x;
      let y1: number = firstVertex.y;
      let y2: number = firstVertex.y;

      for (let j = 1; j < verticesPerImage; j += 1) {
        const vertex = vertices[i + j];
        if (vertex.x < x1) x1 = vertex.x;
        if (vertex.x > x2) x2 = vertex.x;
        if (vertex.y < y1) y1 = vertex.y;
        if (vertex.y > y2) y2 = vertex.y;
      }

      const image: Image2D = {
        x: x1,
        y: y1,
        w: x2 - x1,
        h: y2 - y1,
        ax: firstVertex.ax,
        ay: firstVertex.ay,
        aw: firstVertex.aw,
        ah: firstVertex.ah,
        r: firstVertex.r,
        g: firstVertex.g,
        b: firstVertex.b,
        a: firstVertex.a,
        expanded: false,
      };
      if (useSublist) {
        sublist.push(image);
        if (sublist.length >= sublistMaxImageCount) {
          const desc = `${images2d.length * sublistMaxImageCount}-${images2d.length * sublistMaxImageCount + sublist.length - 1}`;
          images2d.push({ images: sublist, desc, expanded: false });
          sublist = [];
        }
      } else {
        images2d.push(image);
      }
      image2dCount += 1;
    }
    if (sublist.length > 0) {
      const desc = `${images2d.length * sublistMaxImageCount}-${images2d.length * sublistMaxImageCount + sublist.length - 1}`;
      images2d.push({ images: sublist, desc, expanded: false });
    }
  }
</script>

<div class="ml-3 text-sm">
  {#if typeof entity.animated === "boolean"}
    <div>animated: {entity.animated}</div>
  {/if}

  {#if typeof entity.textureId === "number"}
    <button
      class="hover:bg-gray-200"
      onclick={() => {
        const id = entity.textureId!;
        menuData.selectedTextureId = id.toString();
        menuData.selectedTexture = menuData.textures[id];
        menuData.redraw();
      }}>texture: #{entity.textureId}</button
    >
    <br />
  {/if}

  {#if images2d && image2dCount}
    <MenuCaret
      bind:expanded
      id={`${entity.uuid}-images2d`}
      text={`2D images (${image2dCount})`}
    />
    {#if expanded}
      {#each images2d as item, i}
        {#if isImageSublist(item)}
          <MenuCaret
            bind:expanded={item.expanded}
            id={`${entity.uuid}-images-${item.desc}`}
            text={`[Images ${item.desc}]`}
          />
          {#if item.expanded}
            <div class="ml-2">
              {#each item.images as image, j}
                <MenuCaret
                  bind:expanded={image.expanded}
                  id={`${entity.uuid}-images-${item.desc}-${j}`}
                  text={`Image ${i * sublistMaxImageCount + j}`}
                />
                {#if image.expanded}
                  <MenuImage2D {image} />
                {/if}
              {/each}
            </div>
          {/if}
        {:else}
          <MenuCaret
            bind:expanded={item.expanded}
            id={`${entity.uuid}-images-${i}`}
            text={`Image ${i}`}
          />
          {#if item.expanded}
            <MenuImage2D image={item} />
          {/if}
        {/if}
      {/each}
    {/if}
  {/if}
</div>
