// @ts-check
import { defineConfig } from 'astro/config';

import tailwindcss from '@tailwindcss/vite';
import mdx from '@astrojs/mdx';
import react from '@astrojs/react';

// https://astro.build/config
export default defineConfig({
  site: 'https://kskim.dev',
  image: {
    service: {
      entrypoint: 'astro/assets/services/sharp',
      config: {
        quality: 100
      }
    }
  },
  vite: {
    plugins: [tailwindcss()],
    assetsInclude: ['**/*.heic', '**/*.HEIC', '**/*.heif', '**/*.HEIF']
  },

  integrations: [mdx(), react()]
});