<template>
    <div class="app">
        <router-view />
    </div>
</template>

<script>
import './assets/main.css'

export default {
    name: 'App'
}
</script>

<style>
/* App-specific styles, global styles are in main.css */
.app {
    width: 100%;
    min-height: 100vh;
}
</style>