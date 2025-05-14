<script lang="ts">
  import type { Texture, MenuData } from "./interfaces";
  import MenuEntity from "./MenuEntity.svelte";
  import MenuCaret from "./MenuCaret.svelte";

  export let data: MenuData;

  const selectTexture = (id: string, tex: Texture) => {
    if (data.selectedTexture === tex) {
      data.selectedTexture = null;
    } else {
      data.selectedTextureId = id;
      data.selectedTexture = tex;
    }
    data.redraw();
  };

  const level: number = 1;
</script>

<div class="static select-none m-0 border-none w-full">
  <b>All textures</b>
</div>
{#each Object.entries(data.textures) as [id, texture]}
  <div class="static select-none m-0 border-none w-full text-left">
    <button
      class={data.selectedTexture === texture
        ? "bg-rose-400 hover:bg-rose-500 w-full"
        : "bg-slate-300 hover:bg-slate-400 w-full"}
      onclick={() => selectTexture(id, texture)}
    >
      #{id}
    </button>
  </div>
{/each}
<br />
<div class="static select-none m-0 border-none w-full">
  <b>All entities</b>
</div>
{#each data.entities as entity, i}
  <div
    class={`select-none m-0 border-none w-full ${i & 1 ? "bg-[#c4c4e4]" : "bg-[#b8b8d8]"}`}
  >
    <MenuCaret
      bind:expanded={entity.expanded}
      id={`menu${i}`}
      text={entity.type}
      bind:checked={entity.enabled}
      oncheckedchange={data.redraw}
      {level}
    />
    {#if entity.expanded}
      <MenuEntity bind:entity bind:menuData={data} level={level + 1}
      ></MenuEntity>
    {/if}
  </div>
{/each}
