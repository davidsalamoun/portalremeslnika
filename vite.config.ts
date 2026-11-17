import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

// Adresa webu pro náhled odkazu (og:image musí být celá adresa). Na Vercelu ji dá prostředí, jinak SITE_URL;
// bez ní zůstane cesta relativní.
const siteUrl = (
  process.env.SITE_URL ||
  (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : '')
).replace(/\/$/, '');

export default defineConfig(() => {
  return {
    plugins: [
      react(),
      tailwindcss(),
      {
        name: 'site-url',
        transformIndexHtml: (html: string) => html.replaceAll('__SITE_URL__', siteUrl),
      },
    ],
    resolve: {
      alias: {
        '@': path.resolve(import.meta.dirname, '.'),
      },
    },
  };
});
