/**
 * This script copies the necessary files from the original project to the Vue 3 project.
 * Run this script after setting up the Vue 3 project directory structure.
 */
const fs = require('fs');
const path = require('path');

// Source and destination directories
const srcDir = path.join(__dirname, '..');
const destDir = __dirname;

// Files to copy
const filesToCopy = [
    { src: 'public/bg.jpg', dest: 'public/bg.jpg' },
    { src: 'public/RoomClient.js', dest: 'public/RoomClient.js' },
    { src: 'public/modules/EventEmitter.min.js', dest: 'public/modules/EventEmitter.min.js' },
    { src: 'public/modules/mediasoupclient.min.js', dest: 'public/modules/mediasoupclient.min.js' },
    { src: 'public/modules/bootstrap.min.css', dest: 'public/modules/bootstrap.min.css' },
    { src: 'public/modules/bootstrap.bundle.min.js', dest: 'public/modules/bootstrap.bundle.min.js' },
    { src: 'src/app.js', dest: 'server/app.js' },
    { src: 'src/config.js', dest: 'server/config.js' },
    { src: 'src/Room.js', dest: 'server/Room.js' },
    { src: 'src/Peer.js', dest: 'server/Peer.js' },
    { src: 'ssl/key.pem', dest: 'ssl/key.pem' },
    { src: 'ssl/cert.pem', dest: 'ssl/cert.pem' }
];

// Create necessary directories
const dirsToCreate = [
    'public/modules',
    'server',
    'ssl'
];

dirsToCreate.forEach(dir => {
    const dirPath = path.join(destDir, dir);
    if (!fs.existsSync(dirPath)) {
        console.log(`Creating directory: ${dirPath}`);
        fs.mkdirSync(dirPath, { recursive: true });
    }
});

// Copy files
filesToCopy.forEach(file => {
    const srcPath = path.join(srcDir, file.src);
    const destPath = path.join(destDir, file.dest);

    try {
        if (fs.existsSync(srcPath)) {
            console.log(`Copying ${file.src} to ${file.dest}`);
            const data = fs.readFileSync(srcPath);
            fs.writeFileSync(destPath, data);
        } else {
            console.error(`Source file does not exist: ${srcPath}`);
        }
    } catch (err) {
        console.error(`Error copying ${file.src}: ${err.message}`);
    }
});

console.log('Setup complete!'); 