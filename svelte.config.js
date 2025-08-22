import adapter from '@sveltejs/adapter-static';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	kit: {
		adapter: adapter({
			pages: 'dist',
			assets: 'dist',
			fallback: 'index.html'
		}),
		paths: {
			base: process.env.NODE_ENV === 'production' ? '/OksHouse-Admin' : ''
		},
		prerender: {
			entries: ['*']
		}
	}
};

export default config;