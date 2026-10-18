import { mount } from 'svelte';
import '@xyflow/svelte/dist/style.css';
import '@fontsource/atkinson-hyperlegible/400.css';
import '@fontsource/atkinson-hyperlegible/700.css';
import '@fontsource/atkinson-hyperlegible/400-italic.css';
import './app.css';
import App from './App.svelte';
import { app as state } from './lib/stores/app.svelte';
import { MODULES } from './lib/editors/registry';

const app = mount(App, { target: document.getElementById('app')! });

// `?debug` in the URL (browser builds only) exposes the store for scripted tests.
if (new URLSearchParams(location.search).has('debug')) Object.assign(window as object, { __app: state, __modules: MODULES });

export default app;
