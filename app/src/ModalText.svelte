<script lang="ts">
  export let text: string | null;
  let textarea: HTMLTextAreaElement;

  const copy = () => textarea.select();
</script>

<!-- svelte-ignore a11y-no-static-element-interactions -->
<div
  onkeydown={(e) => {
    if (e.key !== "Escape") return;
    e.preventDefault();
    text = null;
  }}
  class="absolute backdrop-blur-sm h-full w-full left-0 top-0 m-0 p-12 overflow-none focus-visible:outline-none"
>
  <div class="w-full h-full p-4 bg-slate-100 rounded-lg flex flex-col">
    <textarea
      bind:this={textarea}
      class="w-full flex-grow border border-black resize-none rounded-md"
      bind:value={text}
    ></textarea>
    <button
      class="w-full h-fit rounded-sm p-2 mt-1 text-xl font-bold bg-blue-500 opacity-90 hover:opacity-100"
      onclick={copy}
    >
      Select all
    </button>
    <button
      class="absolute right-3 top-3 rounded-full bg-gray-300 p-[2px] shadow-lg opacity-75 hover:opacity-100"
      onclick={() => (text = null)}
    >
      <img
        src="plugin://app/images/xmark-solid.svg"
        class="h-5 w-5"
        alt="close"
      />
    </button>
  </div>
</div>
