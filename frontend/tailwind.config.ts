import flowbitePlugin from 'flowbite/plugin'

import type { Config } from 'tailwindcss';

export default {
	content: ['./src/**/*.{html,js,svelte,ts}', './node_modules/flowbite-svelte/**/*.{html,js,svelte,ts}',
    "./node_modules/flowbite-svelte-icons/**/*.{html,js,svelte,ts}",
  ],
  darkMode: 'selector',
	theme: {
		extend: {
      colors: {
        // flowbite-svelte
        primary: {
          '50': '#faf4ff',
          '100': '#f4e7ff',
          '200': '#ebd2ff',
          '300': '#dcafff',
          '400': '#c67cff',
          '500': '#b04bff',
          '600': '#9d27f6',
          '700': '#8817d9',
          '800': '#7a1abc',
          '900': '#5e158e',
          '950': '#41016a',
       }
      }
    }
	},

	plugins: [flowbitePlugin]
} as Config;