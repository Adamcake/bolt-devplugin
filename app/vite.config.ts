import { defineConfig } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import tailwindcss from "@tailwindcss/vite";

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    {
      name: "fixpluginhtml",
      transformIndexHtml: (html) =>
        html
          .replaceAll("crossorigin ", "")
          .replaceAll('"/assets', '"plugin://app/dist/assets'),
    },
    svelte(),
    tailwindcss(),
  ],
});
