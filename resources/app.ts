// Fonts are self-hosted: no request leaves the site for a typeface.
import '@fontsource-variable/bricolage-grotesque/opsz.css';
import '@fontsource-variable/plus-jakarta-sans/wght.css';
import './index.css';
import { createApp } from 'vue';
import App from '../src/app/App.vue';
import router from '../src/app/router';

createApp(App).use(router).mount('#app');
