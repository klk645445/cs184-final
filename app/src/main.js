import { App } from './core/App.js';
import { showError } from './core/ErrorOverlay.js';

const app = new App(document.getElementById('canvas'));
window.app = app; // for poking at things from the browser console

app.init().catch((e) => showError(`Startup failed: ${e.stack || e}`));
