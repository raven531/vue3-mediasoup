/**
 * Server entry point for the Vue3 Mediasoup Video Rooms application
 */

// Import the app module
const { app, io, roomList, getMediasoupWorker } = require('./app');

// Log startup information
console.log('Vue 3 Mediasoup Video Rooms server is running!');
console.log('Access the application at https://localhost:3016/');

// Export the server components for potential external use
module.exports = {
    app,
    io,
    roomList,
    getMediasoupWorker
}; 