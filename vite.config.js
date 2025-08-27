import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	base: '/OksHouse-Admin/',
	plugins: [sveltekit()],
	server: {
		port: 5174
	},
	preview: {
		port: 5174
	}
});