<script lang="ts">
  import { onDragStart, onDragEnter, onDragEnd } from "./draghandler";

  export let expanded: boolean;
  export let id: string;
  export let text: string;
  export let checked: boolean | null = null;
  export let level: number;

  export let onexpandedchange: (() => void) | null = null;
  export let oncheckedchange: (() => void) | null = null;

  const setExpanded = (e: boolean) => {
    expanded = e;
    if (onexpandedchange) {
      onexpandedchange();
    }
  };

  const setChecked = (b: boolean) => {
    checked = b;
    if (oncheckedchange) {
      oncheckedchange();
    }
  };

  const ondragstart = () => onDragStart(!checked, level, id, setChecked);
  const ondragenter = () => onDragEnter(level, id, setChecked);
  const ondragend = onDragEnd;
</script>

{#if expanded}
  <button
    id={checked === null ? id : null}
    class="h-4 w-4 rounded-lg hover:bg-white"
    onclick={() => setExpanded(false)}
    ><img
      src="plugin://app/images/caret-down-solid.svg"
      class="h-full w-full"
      alt="hide"
    /></button
  >
{:else}
  <button
    id={checked === null ? id : null}
    class="h-4 w-4 rounded-lg hover:bg-white"
    onclick={() => setExpanded(true)}
    ><img
      src="plugin://app/images/caret-down-solid.svg"
      class="h-full w-full rotate-270"
      alt="expand"
    /></button
  >
{/if}
{#if checked !== null}
  <input
    draggable={true}
    {id}
    type="checkbox"
    bind:checked
    onchange={oncheckedchange}
    {ondragstart}
    {ondragenter}
    {ondragend}
  />
{/if}
<label
  for={id}
  draggable={true}
  onchange={oncheckedchange}
  {ondragstart}
  {ondragenter}
  {ondragend}>{text}</label
>
<br />
