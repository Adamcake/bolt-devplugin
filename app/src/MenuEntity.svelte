<script lang="ts">
  import type {
    Entity,
    MenuData,
    ImageData2D,
    VertexData3D,
  } from "./interfaces";
  import MenuCaret from "./MenuCaret.svelte";
  import MenuImage2D from "./MenuImage2D.svelte";
  import MenuVertex3D from "./MenuVertex3D.svelte";
  export let entity: Entity;
  export let menuData: MenuData;

  const verticesPerImage = 6;
  const sublistMaxItemCount = 100;

  let expandedImages = false;
  let expandedVertices = false;

  interface ImageSublist {
    images: ImageData2D[];
    desc: string;
    expanded: boolean;
    vertexRangeStart: number;
    vertexRangeEnd: number;
  }

  interface VertexSublist {
    vertices: VertexData3D[];
    desc: string;
    expanded: boolean;
  }

  function isImageSublist(
    object: ImageData2D | ImageSublist,
  ): object is ImageSublist {
    return "images" in object;
  }

  function isVertexSublist(
    object: VertexData3D | VertexSublist,
  ): object is VertexSublist {
    return "vertices" in object;
  }

  let images2d: (ImageData2D | ImageSublist)[] | null = null;
  let image2dCount = 0;
  let vertices3d: (VertexData3D | VertexSublist)[] | null = null;
  let vertex3dCount = 0;
  if (entity.type === "batch2d" || entity.type === "minimap2d") {
    const vertices = entity.vertices!;
    const sublistMinimumImages = sublistMaxItemCount * 2;
    const useSublist =
      vertices.length >= sublistMinimumImages * verticesPerImage;
    images2d = [];
    let sublist: ImageData2D[] = [];
    let sublistFirstVertex = 0;
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

      const image: ImageData2D = {
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
        index: image2dCount,
      };
      if (useSublist) {
        sublist.push(image);
        if (sublist.length >= sublistMaxItemCount) {
          const desc = `${images2d.length * sublistMaxItemCount}-${images2d.length * sublistMaxItemCount + sublist.length - 1}`;
          const vertexRangeEnd = i + verticesPerImage;
          images2d.push({
            images: sublist,
            desc,
            expanded: false,
            vertexRangeStart: sublistFirstVertex,
            vertexRangeEnd,
          });
          sublist = [];
          sublistFirstVertex = vertexRangeEnd;
        }
      } else {
        images2d.push(image);
      }
      image2dCount += 1;
    }
    if (sublist.length > 0) {
      const desc = `${images2d.length * sublistMaxItemCount}-${images2d.length * sublistMaxItemCount + sublist.length - 1}`;
      images2d.push({
        images: sublist,
        desc,
        expanded: false,
        vertexRangeStart: sublistFirstVertex,
        vertexRangeEnd: vertices.length,
      });
    }
  } else if (entity.vertices) {
    const sublistMinimumVertices = sublistMaxItemCount * 2;
    const useSublist = entity.vertices.length >= sublistMinimumVertices;
    vertices3d = [];
    let sublist: VertexData3D[] = [];
    let sublistFirstVertex = 0;
    for (
      let i = 0;
      i < entity.vertices.length - (verticesPerImage - 1);
      i += verticesPerImage
    ) {
      const vertex = entity.vertices[i];

      const vertexData: VertexData3D = {
        modelpoint: entity.type !== "renderparticles" ? { ...vertex } : null,
        expanded: false,
        index: vertex3dCount,
        ...vertex,
      };
      if (useSublist) {
        sublist.push(vertexData);
        if (sublist.length >= sublistMaxItemCount) {
          const desc = `${vertices3d.length * sublistMaxItemCount}-${vertices3d.length * sublistMaxItemCount + sublist.length - 1}`;
          const vertexRangeEnd = i + verticesPerImage;
          vertices3d.push({
            vertices: sublist,
            desc,
            expanded: false,
          });
          sublist = [];
          sublistFirstVertex = vertexRangeEnd;
        }
      } else {
        vertices3d.push(vertexData);
      }
      vertex3dCount += 1;
    }
    if (sublist.length > 0) {
      const desc = `${vertices3d.length * sublistMaxItemCount}-${vertices3d.length * sublistMaxItemCount + sublist.length - 1}`;
      vertices3d.push({
        vertices: sublist,
        desc,
        expanded: false,
      });
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
      bind:expanded={expandedImages}
      id={`${entity.uuid}-images2d`}
      text={`2D images (${image2dCount})`}
    />
    {#if expandedImages}
      {#each images2d as item, i}
        {#if isImageSublist(item)}
          <MenuCaret
            bind:expanded={item.expanded}
            bind:checked={
              () =>
                item.images.every(
                  (x) =>
                    entity.enabledVerticesList![x.index * verticesPerImage],
                ),
              (b: boolean) => {
                for (
                  let x = item.vertexRangeStart;
                  x < item.vertexRangeEnd;
                  x += 1
                ) {
                  entity.enabledVerticesList![x] = b;
                }
              }
            }
            oncheckedchange={menuData.redraw}
            id={`${entity.uuid}-images-${item.desc}`}
            text={`[Images ${item.desc}]`}
          />
          {#if item.expanded}
            <div class="ml-2">
              {#each item.images as image, j}
                <MenuCaret
                  bind:expanded={image.expanded}
                  bind:checked={
                    () =>
                      entity.enabledVerticesList![
                        image.index * verticesPerImage
                      ],
                    (b: boolean) => {
                      for (let x = 0; x < verticesPerImage; x += 1) {
                        entity.enabledVerticesList![
                          image.index * verticesPerImage + x
                        ] = b;
                      }
                    }
                  }
                  oncheckedchange={menuData.redraw}
                  id={`${entity.uuid}-images-${item.desc}-${j}`}
                  text={`Image ${i * sublistMaxItemCount + j}`}
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
            bind:checked={
              () => entity.enabledVerticesList![item.index * verticesPerImage],
              (b: boolean) => {
                for (let x = 0; x < verticesPerImage; x += 1) {
                  entity.enabledVerticesList![
                    item.index * verticesPerImage + x
                  ] = b;
                }
              }
            }
            oncheckedchange={menuData.redraw}
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

  {#if vertices3d && vertex3dCount}
    <MenuCaret
      bind:expanded={expandedVertices}
      id={`${entity.uuid}-vertices3d`}
      text={`3D vertices (${vertex3dCount})`}
    />
    {#if expandedVertices}
      {#each vertices3d as item, i}
        {#if isVertexSublist(item)}
          <MenuCaret
            bind:expanded={item.expanded}
            id={`${entity.uuid}-vertices-${item.desc}`}
            text={`[Vertices ${item.desc}]`}
          />
          {#if item.expanded}
            <div class="ml-2">
              {#each item.vertices as vertex, j}
                <MenuCaret
                  bind:expanded={vertex.expanded}
                  id={`${entity.uuid}-vertices-${item.desc}-${j}`}
                  text={`Vertex ${i * sublistMaxItemCount + j}`}
                />
                {#if vertex.expanded}
                  <MenuVertex3D {vertex} />
                {/if}
              {/each}
            </div>
          {/if}
        {:else}
          <MenuCaret
            bind:expanded={item.expanded}
            id={`${entity.uuid}-vertices-${i}`}
            text={`Vertex ${i}`}
          />
          {#if item.expanded}
            <MenuVertex3D vertex={item} />
          {/if}
        {/if}
      {/each}
    {/if}
  {/if}
</div>
