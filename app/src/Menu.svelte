<script lang="ts">
  import type { Entity } from "./interfaces";

  export let entities: Entity[];
  export let redraw: () => void;

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
    entities = entities;
    redraw();
  };
</script>

<div class="static select-none m-0 border-none w-full">
  <b>All entities</b>
</div>
{#each entities as entity, i}
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
