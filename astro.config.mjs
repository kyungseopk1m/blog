// @ts-check
import { defineConfig } from 'astro/config';

import tailwindcss from '@tailwindcss/vite';
import mdx from '@astrojs/mdx';
import react from '@astrojs/react';

// https://astro.build/config
export default defineConfig({
  site: 'https://kyungseopk1m.github.io',
  image: {
    service: {
      entrypoint: 'astro/assets/services/sharp',
      config: {
        quality: 100
      }
    }
  },
  vite: {
    plugins: [tailwindcss()]
  },

  integrations: [mdx(), react()]
});