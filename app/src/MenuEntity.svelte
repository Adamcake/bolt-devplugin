<script lang="ts">
  import type {
    Entity,
    MenuData,
    Vertex,
    Model,
    ModelVertexData,
    ImageData2D,
    VertexData3D,
  } from "./interfaces";
  import { chunksExact, createSublists } from "./functions";
  import MenuCaret from "./MenuCaret.svelte";
  import MenuImage2D from "./MenuImage2D.svelte";
  import MenuVertex3D from "./MenuVertex3D.svelte";
  import MenuModelVertex from "./MenuModelVertex.svelte";
  export let entity: Entity;
  export let menuData: MenuData;
  export let level: number;

  const verticesPerImage = 6;
  const sublistMaxItemCount = 100;

  let expandedImages = false;
  let expandedVertices = false;
  let expandedModels = false;

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

  interface ModelData {
    vertices: ModelVertexData[] | ModelVertexSublist[];
    vertexCount: number;
    expanded: boolean;
    verticesExpanded: boolean;
    index: number;
  }

  interface ModelVertexSublist {
    vertices: ModelVertexData[];
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

  function isModelVertexSublist(
    object: ModelVertexData | ModelVertexSublist,
  ): object is ModelVertexSublist {
    return "vertices" in object;
  }

  const createImage = (vertices: Vertex[], index: number): ImageData2D => {
    const firstVertex = vertices[0];
    let x1: number = firstVertex.x;
    let x2: number = firstVertex.x;
    let y1: number = firstVertex.y;
    let y2: number = firstVertex.y;

    for (const vertex of vertices) {
      if (vertex.x < x1) x1 = vertex.x;
      if (vertex.x > x2) x2 = vertex.x;
      if (vertex.y < y1) y1 = vertex.y;
      if (vertex.y > y2) y2 = vertex.y;
    }

    return {
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
      index,
    };
  };

  const createImageSublist = (
    list: ImageData2D[],
    index: number,
  ): ImageSublist => {
    const startIndex = index * sublistMaxItemCount;
    const vertexRangeStart = startIndex * verticesPerImage;
    return {
      images: list,
      desc: `${startIndex}-${startIndex + list.length - 1}`,
      expanded: false,
      vertexRangeStart,
      vertexRangeEnd: vertexRangeStart + list.length * verticesPerImage,
    };
  };

  const createVertex = (vertex: Vertex, index: number): VertexData3D => {
    return {
      modelpoint: { ...vertex },
      expanded: false,
      index,
      ...vertex,
    };
  };

  const createWorldVertex = (vertex: Vertex, index: number): VertexData3D => {
    return {
      modelpoint: null,
      expanded: false,
      index,
      ...vertex,
    };
  };

  const createVertexSublist = (
    list: VertexData3D[],
    index: number,
  ): VertexSublist => {
    const startIndex = index * sublistMaxItemCount;
    return {
      vertices: list,
      desc: `${startIndex}-${startIndex + list.length - 1}`,
      expanded: false,
    };
  };

  const createModelVertex = (
    vertex: Vertex,
    index: number,
  ): ModelVertexData => {
    return {
      modelpoint: { ...vertex },
      expanded: false,
      index,
      ...vertex,
    };
  };

  const createModelVertexSublist = (
    list: ModelVertexData[],
    index: number,
  ): ModelVertexSublist => {
    const startIndex = index * sublistMaxItemCount;
    return {
      vertices: list,
      desc: `${startIndex}-${startIndex + list.length - 1}`,
      expanded: false,
    };
  };

  const createModel = (model: Model, index: number): ModelData => {
    const vertices: ModelVertexData[] | ModelVertexSublist[] = createSublists(
      model.vertices,
      sublistMaxItemCount,
      createModelVertex,
      createModelVertexSublist,
    );
    return {
      vertices,
      vertexCount: model.vertices.length,
      expanded: false,
      verticesExpanded: false,
      index,
    };
  };

  let images2d: ImageData2D[] | ImageSublist[] | null = null;
  let image2dCount = 0;
  let vertices3d: VertexData3D[] | VertexSublist[] | null = null;
  let vertex3dCount = 0;
  let models: ModelData[] | null = null;
  let modelCount = 0;
  if (entity.type === "batch2d" || entity.type === "minimap2d") {
    const list = [...chunksExact(entity.vertices!, verticesPerImage)];
    image2dCount = list.length;
    images2d = createSublists(
      list,
      sublistMaxItemCount,
      createImage,
      createImageSublist,
    );
  } else if (entity.vertices) {
    const convert =
      entity.type !== "renderparticles" ? createVertex : createWorldVertex;
    vertex3dCount = entity.vertices.length;
    vertices3d = createSublists(
      entity.vertices,
      sublistMaxItemCount,
      convert,
      createVertexSublist,
    );
  }

  if (entity.models) {
    modelCount = entity.models.length;
    models = entity.models.map(createModel);
  }

  const viewTextureFromAtlas = (image: ImageData2D | VertexData3D) => {
    const id = entity.textureId!;
    const tex = menuData.textures[id];
    menuData.selectedTextureId = entity.uuid;
    menuData.selectedTexture = tex;
    menuData.textureBoundX = image.ax;
    menuData.textureBoundY = image.ay;
    menuData.textureBoundW = image.aw;
    menuData.textureBoundH = image.ah;
    menuData.textureViewX = 0;
    menuData.textureViewY = 0;
    menuData.textureViewScale = 100;
    menuData.viewIsWholeAtlas = false;
    menuData.redraw();
  };
</script>

<div class="ml-3 text-sm">
  {#if typeof entity.animated === "boolean"}
    <div>animated: {entity.animated}</div>
  {/if}

  {#if typeof entity.textureId === "number"}
    <button
      class="px-1 bg-gray-200 hover:bg-gray-100"
      onclick={() => {
        const id = entity.textureId!;
        const tex = menuData.textures[id];
        menuData.selectedTextureId = id.toString();
        menuData.selectedTexture = tex;
        menuData.textureBoundX = 0;
        menuData.textureBoundY = 0;
        menuData.textureBoundW = tex.width;
        menuData.textureBoundH = tex.height;
        menuData.textureViewX = 0;
        menuData.textureViewY = 0;
        menuData.textureViewScale = 100;
        menuData.viewIsWholeAtlas = true;
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
      {level}
    />
    {#if expandedImages}
      {#each images2d as item, i}
        <div class="ml-1">
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
              level={level + 1}
            />
            {#if item.expanded}
              <div class="ml-1">
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
                    level={level + 2}
                  />
                  {#if image.expanded}
                    <MenuImage2D {image} view={viewTextureFromAtlas} />
                  {/if}
                {/each}
              </div>
            {/if}
          {:else}
            <MenuCaret
              bind:expanded={item.expanded}
              bind:checked={
                () =>
                  entity.enabledVerticesList![item.index * verticesPerImage],
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
              level={level + 1}
            />
            {#if item.expanded}
              <MenuImage2D image={item} view={viewTextureFromAtlas} />
            {/if}
          {/if}
        </div>
      {/each}
    {/if}
  {/if}

  {#if vertices3d && vertex3dCount}
    <MenuCaret
      bind:expanded={expandedVertices}
      id={`${entity.uuid}-vertices3d`}
      text={`3D vertices (${vertex3dCount})`}
      {level}
    />
    {#if expandedVertices}
      {#each vertices3d as item}
        <div class="ml-1">
          {#if isVertexSublist(item)}
            <MenuCaret
              bind:expanded={item.expanded}
              id={`${entity.uuid}-vertices-${item.desc}`}
              text={`[Vertices ${item.desc}]`}
              level={level + 1}
            />
            {#if item.expanded}
              <div class="ml-1">
                {#each item.vertices as vertex}
                  <MenuCaret
                    bind:expanded={vertex.expanded}
                    id={`${entity.uuid}-vertices-${item.desc}-${vertex.index}`}
                    text={`Vertex ${vertex.index}`}
                    level={level + 2}
                  />
                  {#if vertex.expanded}
                    <MenuVertex3D {vertex} view={viewTextureFromAtlas} />
                  {/if}
                {/each}
              </div>
            {/if}
          {:else}
            <MenuCaret
              bind:expanded={item.expanded}
              id={`${entity.uuid}-vertices-${item.index}`}
              text={`Vertex ${item.index}`}
              level={level + 1}
            />
            {#if item.expanded}
              <MenuVertex3D vertex={item} view={viewTextureFromAtlas} />
            {/if}
          {/if}
        </div>
      {/each}
    {/if}
  {/if}

  {#if models && modelCount}
    screen: {entity.targetx},{entity.targety}
    {entity.targetw}x{entity.targeth}
    <br />
    <MenuCaret
      bind:expanded={expandedModels}
      id={`${entity.uuid}-models`}
      text={`Models (${modelCount})`}
      {level}
    />
    {#if expandedModels}
      {#each models as model}
        <div class="ml-1">
          <MenuCaret
            bind:expanded={model.expanded}
            id={`${entity.uuid}-models`}
            text={`Model ${model.index}`}
            level={level + 1}
          />
          {#if model.expanded}
            <MenuCaret
              bind:expanded={model.verticesExpanded}
              id={`${entity.uuid}-vertices`}
              text={`Vertices (${model.vertexCount})`}
              level={level + 2}
            />
            {#if model.verticesExpanded}
              {#each model.vertices as item}
                <div class="ml-1">
                  {#if isModelVertexSublist(item)}
                    <MenuCaret
                      bind:expanded={item.expanded}
                      id={`${entity.uuid}-vertices-${item.desc}`}
                      text={`[Vertices ${item.desc}]`}
                      level={level + 3}
                    />
                    {#if item.expanded}
                      <div class="ml-1">
                        {#each item.vertices as vertex}
                          <MenuCaret
                            bind:expanded={vertex.expanded}
                            id={`${entity.uuid}-vertices-${item.desc}-${vertex.index}`}
                            text={`Vertex ${vertex.index}`}
                            level={level + 4}
                          />
                          {#if vertex.expanded}
                            <MenuModelVertex {vertex} />
                          {/if}
                        {/each}
                      </div>
                    {/if}
                  {:else}
                    <MenuCaret
                      bind:expanded={item.expanded}
                      id={`${entity.uuid}-${model.index}-vertex-${item.index}`}
                      text={`Vertex ${item.index}`}
                      level={level + 3}
                    />
                    {#if item.expanded}
                      <MenuModelVertex vertex={item} />
                    {/if}
                  {/if}
                </div>
              {/each}
            {/if}
          {/if}
        </div>
      {/each}
    {/if}
  {/if}
</div>
