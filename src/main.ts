import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import './styles/main.css'

const app = createApp(App)

app.config.errorHandler = (err, _instance, info) => {
  // eslint-disable-next-line no-console
  console.error(`[Global Error] ${info}:`, err)
}

app.use(createPinia())
app.use(router)
app.mount('#app')
