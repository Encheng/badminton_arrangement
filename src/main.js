import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
// router imported and registered in Task 6 (src/router/index.js)

const app = createApp(App)

app.use(createPinia())

app.mount('#app')
