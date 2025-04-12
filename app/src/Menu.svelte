<script lang="ts">
  import type { Entity, Texture, MenuData } from "./interfaces";

  export let data: MenuData;
  export let redraw: () => void;

  const selectTexture = (id: string, tex: Texture) => {
    if (data.selectedTexture === tex) {
      data.selectedTexture = null;
    } else {
      data.selectedTextureId = id;
      data.selectedTexture = tex;
    }
    redraw();
  };

  let draggedEntity: Entity | null = null;
  let draggedInitialChange: boolean = false;
  let dragEnableState: boolean = false;
  const dragStart = (entity: Entity) => {
    draggedEntity = entity;
    dragEnableState = !entity.enabled;
  };
  const dragEnd = () => {
    draggedInitialChange = false;
    draggedEntity = null;
  };
  const dragEnter = (entity: Entity) => {
    if (!draggedEntity) return;
    if (!draggedInitialChange) {
      draggedEntity.enabled = dragEnableState;
    }
    entity.enabled = dragEnableState;
    data = data;
    redraw();
  };
</script>

<div class="static select-none m-0 border-none w-full">
  <b>All textures</b>
</div>
{#each Object.entries(data.textures) as [id, texture]}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="static select-none m-0 border-none w-full text-left">
    <button
      class={data.selectedTexture === texture
        ? "bg-rose-400 hover:bg-rose-500 w-full"
        : "bg-slate-300 hover:bg-slate-400 w-full"}
      onclick={() => selectTexture(id, texture)}
    >
      {id}
    </button>
  </div>
{/each}
<br />
<div class="static select-none m-0 border-none w-full">
  <b>All entities</b>
</div>
{#each data.entities as entity, i}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="static select-none m-0 border-none w-full"
    ondragenter={() => dragEnter(entity)}
  >
    <input
      draggable={true}
      id={`menu${i}`}
      class="ml-1"
      type="checkbox"
      bind:checked={entity.enabled}
      onchange={redraw}
      ondragstart={() => dragStart(entity)}
      ondragend={dragEnd}
    />
    <label
      draggable={true}
      for={`menu${i}`}
      ondragstart={() => dragStart(entity)}
      ondragend={dragEnd}>{entity.type}</label
    >
    <br />
  </div>
{/each}
