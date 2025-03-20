// Vue 3 Application
const { createApp, ref, reactive, onMounted, onBeforeUnmount } = Vue;

// Create necessary elements for RoomClient.js if they don't exist
function ensureRequiredElements() {
    const hiddenContainer = document.createElement('div');
    hiddenContainer.className = 'hidden';
    hiddenContainer.style.position = 'absolute';
    hiddenContainer.style.left = '-9999px';
    hiddenContainer.style.visibility = 'hidden';

    // Create login elements
    if (!document.getElementById('login')) {
        const login = document.createElement('div');
        login.id = 'login';

        const roomIdInput = document.createElement('input');
        roomIdInput.id = 'roomidInput';
        roomIdInput.value = '123';
        login.appendChild(roomIdInput);

        const nameInput = document.createElement('input');
        nameInput.id = 'nameInput';
        nameInput.value = 'user';
        login.appendChild(nameInput);

        const joinButton = document.createElement('button');
        joinButton.id = 'joinButton';
        login.appendChild(joinButton);

        hiddenContainer.appendChild(login);
    }

    // Create control elements
    if (!document.getElementById('control')) {
        const control = document.createElement('div');
        control.id = 'control';
        control.className = 'hidden';

        // Add all control buttons
        const buttonIds = [
            'exitButton', 'copyButton', 'devicesButton',
            'startAudioButton', 'stopAudioButton',
            'startVideoButton', 'stopVideoButton',
            'startScreenButton', 'stopScreenButton'
        ];

        buttonIds.forEach(id => {
            const button = document.createElement('button');
            button.id = id;
            button.className = 'hidden';
            control.appendChild(button);
        });

        // Add devices list
        const devicesList = document.createElement('div');
        devicesList.id = 'devicesList';
        devicesList.className = 'hidden';

        const audioSelect = document.createElement('select');
        audioSelect.id = 'audioSelect';
        audioSelect.className = 'form-select';
        devicesList.appendChild(audioSelect);

        const videoSelect = document.createElement('select');
        videoSelect.id = 'videoSelect';
        videoSelect.className = 'form-select';
        devicesList.appendChild(videoSelect);

        control.appendChild(devicesList);
        hiddenContainer.appendChild(control);
    }

    // Create video media elements
    if (!document.getElementById('videoMedia')) {
        const videoMedia = document.createElement('div');
        videoMedia.id = 'videoMedia';
        videoMedia.className = 'hidden';

        const localMedia = document.createElement('div');
        localMedia.id = 'localMedia';
        localMedia.className = 'containers';
        videoMedia.appendChild(localMedia);

        const remoteVideos = document.createElement('div');
        remoteVideos.id = 'remoteVideos';
        remoteVideos.className = 'containers';
        videoMedia.appendChild(remoteVideos);

        const remoteAudios = document.createElement('div');
        remoteAudios.id = 'remoteAudios';
        videoMedia.appendChild(remoteAudios);

        hiddenContainer.appendChild(videoMedia);
    }

    document.body.appendChild(hiddenContainer);
}

// The Vue 3 application
const app = createApp({
    setup() {
        // Reactive state
        const room = ref('123');
        const name = ref('user');
        const room_id = ref('');
        const isAudioOn = ref(false);
        const isVideoOn = ref(false);
        const isScreenSharingOn = ref(false);
        const showDevicesList = ref(false);
        const peers = reactive({});
        const audioDevices = ref([]);
        const videoDevices = ref([]);
        const selectedAudioDevice = ref('');
        const selectedVideoDevice = ref('');
        const isJoining = ref(false);

        // Reference to RoomClient
        let rc = null;

        // Initialize everything after mount
        onMounted(() => {
            // Make sure all required elements exist
            ensureRequiredElements();

            // Initialize socket for compatibility
            window.socket = io();

            // Define the request method on socket
            window.socket.request = function (type, data = {}) {
                return new Promise((resolve, reject) => {
                    window.socket.emit(type, data, (data) => {
                        if (data && data.error) {
                            reject(data.error);
                        } else {
                            resolve(data);
                        }
                    });
                });
            };

            // If we have URL parameters for room and name, use them
            const urlParams = new URLSearchParams(window.location.search);
            const roomParam = urlParams.get('room');
            const nameParam = urlParams.get('name');

            if (roomParam) room.value = roomParam;
            if (nameParam) name.value = nameParam;

            // Update hidden elements with the values
            document.getElementById('roomidInput').value = room.value;
            document.getElementById('nameInput').value = name.value;

            // Auto-join if URL parameters are provided
            if (roomParam && nameParam) {
                joinRoom();
            }
        });

        // Join room function
        const joinRoom = async () => {
            if (!name.value || !room.value || isJoining.value) return;

            // Set joining flag to prevent multiple join attempts
            isJoining.value = true;

            try {
                // Update hidden input values
                document.getElementById('roomidInput').value = room.value;
                document.getElementById('nameInput').value = name.value;

                const localMedia = document.getElementById('localMedia');
                const remoteVideos = document.getElementById('remoteVideos');
                const remoteAudios = document.getElementById('remoteAudios');

                // Create local peer entry
                peers['local'] = { id: 'local', name: name.value + ' (You)' };

                // Set room ID to show the room view
                room_id.value = room.value;

                // Make sure socket.request is properly defined
                if (!window.socket.request) {
                    window.socket.request = function (type, data = {}) {
                        return new Promise((resolve, reject) => {
                            window.socket.emit(type, data, (data) => {
                                if (data && data.error) {
                                    reject(data.error);
                                } else {
                                    resolve(data);
                                }
                            });
                        });
                    };
                }

                // Create RoomClient instance
                rc = new RoomClient(
                    localMedia,
                    remoteVideos,
                    remoteAudios,
                    mediasoupClient,
                    window.socket,
                    room.value,
                    name.value,
                    () => {
                        console.log('Room opened');

                        // Check if device is ready before proceeding
                        if (rc.device && rc.producerTransport) {
                            // Start media only when device is ready
                            console.log('Device initialized correctly, starting media');
                            loadDevices();
                            // Start media
                            rc.produce(RoomClient.mediaType.audio);
                            rc.produce(RoomClient.mediaType.video);

                            // Update state
                            isAudioOn.value = true;
                            isVideoOn.value = true;
                            isJoining.value = false;
                        } else {
                            console.log('Device not ready yet, waiting for initialization');

                            // Set up a check interval to wait for device initialization
                            const checkInterval = setInterval(() => {
                                if (rc.device && rc.producerTransport) {
                                    console.log('Device now initialized, starting media');
                                    clearInterval(checkInterval);

                                    // Load devices and start media
                                    loadDevices();
                                    rc.produce(RoomClient.mediaType.audio);
                                    rc.produce(RoomClient.mediaType.video);

                                    // Update state
                                    isAudioOn.value = true;
                                    isVideoOn.value = true;
                                    isJoining.value = false;
                                }
                            }, 500);

                            // Clear interval after 10 seconds to avoid infinite checking
                            setTimeout(() => {
                                clearInterval(checkInterval);
                                isJoining.value = false;
                            }, 10000);
                        }
                    }
                );

                // Setup event handlers
                rc.on(RoomClient.EVENTS.startAudio, () => {
                    isAudioOn.value = true;
                });

                rc.on(RoomClient.EVENTS.stopAudio, () => {
                    isAudioOn.value = false;
                });

                rc.on(RoomClient.EVENTS.startVideo, () => {
                    isVideoOn.value = true;
                });

                rc.on(RoomClient.EVENTS.stopVideo, () => {
                    isVideoOn.value = false;
                });

                rc.on(RoomClient.EVENTS.startScreen, () => {
                    isScreenSharingOn.value = true;
                });

                rc.on(RoomClient.EVENTS.stopScreen, () => {
                    isScreenSharingOn.value = false;
                });

                // Override addVideoElement to handle Vue DOM
                const originalAddVideoElement = rc.addVideoElement;
                rc.addVideoElement = function (id, stream, callback = null) {
                    console.log('Adding video element for:', id);

                    // Ensure peer exists in reactive state
                    if (!peers[id] && id !== 'local') {
                        // Try to get peer name from the socket connections
                        window.socket.emit('getPeerInfo', { peerId: id }, (peerInfo) => {
                            if (peerInfo && peerInfo.name) {
                                peers[id] = { id, name: peerInfo.name };
                            } else {
                                peers[id] = { id, name: 'Remote User' };
                            }
                        });
                    }

                    // Wait for Vue to update DOM
                    setTimeout(() => {
                        // First try to find in Vue-controlled DOM
                        let videoElement = document.getElementById(`v_${id}`);

                        if (videoElement) {
                            videoElement.srcObject = stream;
                            if (callback) callback(videoElement);
                        } else {
                            // If not found, fall back to original implementation
                            originalAddVideoElement.call(rc, id, stream, callback);

                            // Copy stream to Vue DOM if element was created
                            setTimeout(() => {
                                const createdElement = document.querySelector(`#remoteVideos #v_${id}`);
                                if (createdElement && createdElement.srcObject) {
                                    // Ensure peer exists
                                    if (!peers[id] && id !== 'local') {
                                        peers[id] = { id, name: 'Remote User' };
                                    }

                                    // Wait for Vue to update DOM again
                                    setTimeout(() => {
                                        const vueElement = document.getElementById(`v_${id}`);
                                        if (vueElement) {
                                            vueElement.srcObject = createdElement.srcObject;
                                        }
                                    }, 50);
                                }
                            }, 100);
                        }
                    }, 50);
                };

                // Override removeVideoElement to handle Vue DOM
                const originalRemoveVideoElement = rc.removeVideoElement;
                rc.removeVideoElement = function (id) {
                    console.log('Removing video element for:', id);

                    // Remove from peers reactive object
                    if (peers[id]) {
                        delete peers[id];
                    }

                    // Call original implementation
                    originalRemoveVideoElement.call(rc, id);
                };
            } catch (error) {
                console.error('Error joining room:', error);
                isJoining.value = false;
            }
        };

        // Load available devices
        const loadDevices = async () => {
            try {
                // Request permissions first to ensure labels are populated
                try {
                    // Try to get temporary streams to ensure permissions are granted
                    // This will help get device labels
                    const tempAudioStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
                    const tempVideoStream = await navigator.mediaDevices.getUserMedia({ audio: false, video: true });

                    // Stop tracks immediately after getting permissions
                    tempAudioStream.getTracks().forEach(track => track.stop());
                    tempVideoStream.getTracks().forEach(track => track.stop());

                    console.log('Media permissions granted');
                } catch (permissionErr) {
                    // If permissions are denied, continue but warn the user
                    console.warn('Unable to get media permissions:', permissionErr);
                    if (permissionErr.name === 'NotAllowedError') {
                        alert('Please allow camera and microphone permissions to use this app fully.');
                    }
                }

                // Get the list of devices
                const devices = await navigator.mediaDevices.enumerateDevices();

                audioDevices.value = devices.filter(device => device.kind === 'audioinput');
                videoDevices.value = devices.filter(device => device.kind === 'videoinput');

                console.log('Available audio devices:', audioDevices.value);
                console.log('Available video devices:', videoDevices.value);

                // Add a "None" option for cases where user doesn't want to use a device
                audioDevices.value.unshift({ deviceId: 'none', label: 'None (Disabled)' });
                videoDevices.value.unshift({ deviceId: 'none', label: 'None (Disabled)' });

                // Set default selected devices
                if (audioDevices.value.length > 1) {
                    // Skip the "None" option and use the first real device
                    selectedAudioDevice.value = audioDevices.value[1].deviceId;
                } else {
                    // If no real devices, use the "None" option
                    selectedAudioDevice.value = 'none';
                }

                if (videoDevices.value.length > 1) {
                    // Skip the "None" option and use the first real device
                    selectedVideoDevice.value = videoDevices.value[1].deviceId;
                } else {
                    // If no real devices, use the "None" option
                    selectedVideoDevice.value = 'none';
                }
            } catch (error) {
                console.error('Error loading devices:', error);
                alert('Failed to detect media devices. Some features may not work correctly.');

                // Create empty device lists with "None" options
                audioDevices.value = [{ deviceId: 'none', label: 'None (Disabled)' }];
                videoDevices.value = [{ deviceId: 'none', label: 'None (Disabled)' }];

                selectedAudioDevice.value = 'none';
                selectedVideoDevice.value = 'none';
            }
        };

        // Toggle audio
        const toggleAudio = () => {
            if (!rc) return;

            if (isAudioOn.value) {
                rc.closeProducer(RoomClient.mediaType.audio);
            } else {
                // Check if 'none' is selected
                if (selectedAudioDevice.value === 'none') {
                    alert('No microphone selected. Please select a microphone in device settings.');
                    return;
                }

                rc.produce(RoomClient.mediaType.audio, selectedAudioDevice.value);
            }
        };

        // Toggle video
        const toggleVideo = () => {
            if (!rc) return;

            if (isVideoOn.value) {
                rc.closeProducer(RoomClient.mediaType.video);
            } else {
                // Check if 'none' is selected
                if (selectedVideoDevice.value === 'none') {
                    alert('No camera selected. Please select a camera in device settings.');
                    return;
                }

                rc.produce(RoomClient.mediaType.video, selectedVideoDevice.value);
            }
        };

        // Toggle screen sharing
        const toggleScreen = () => {
            if (!rc) {
                console.error('RoomClient not initialized');
                return;
            }

            try {
                // If already sharing screen, close producer
                if (isScreenSharingOn.value) {
                    rc.closeProducer(RoomClient.mediaType.screen);
                    return;
                }

                // Check for device initialization
                if (!rc.device || !rc.producerTransport) {
                    console.warn('Device not fully initialized yet, waiting...');

                    // Show feedback to user
                    alert('Please wait a moment while we prepare screen sharing...');

                    // Set up a check interval to wait for device initialization
                    const checkInterval = setInterval(() => {
                        if (rc.device && rc.producerTransport) {
                            console.log('Device now initialized, starting screen share');
                            clearInterval(checkInterval);

                            // Start screen sharing
                            try {
                                rc.produce(RoomClient.mediaType.screen);
                            } catch (err) {
                                console.error('Error producing screen:', err);
                                alert('Failed to start screen sharing. Please try again.');
                            }
                        }
                    }, 500);

                    // Clear interval after 10 seconds to avoid infinite checking
                    setTimeout(() => {
                        clearInterval(checkInterval);
                        // If still not initialized, show error
                        if (!rc.device || !rc.producerTransport) {
                            alert('Could not initialize media devices. Please try refreshing the page.');
                        }
                    }, 10000);

                    return;
                }

                // If device is ready, start screen sharing
                rc.produce(RoomClient.mediaType.screen);
            } catch (err) {
                console.error('Error in screen sharing:', err);
                alert('Screen sharing failed. Please make sure you have permissions enabled.');
            }
        };

        // Show devices selection
        const showDevices = () => {
            showDevicesList.value = !showDevicesList.value;
        };

        // Change audio device
        const changeAudioDevice = () => {
            if (!rc) return;

            // If 'none' is selected, close the producer if it's active
            if (selectedAudioDevice.value === 'none') {
                if (isAudioOn.value) {
                    rc.closeProducer(RoomClient.mediaType.audio);
                }
                return;
            }

            // If audio is already on, restart it with the new device
            if (isAudioOn.value) {
                rc.closeProducer(RoomClient.mediaType.audio);
                setTimeout(() => {
                    rc.produce(RoomClient.mediaType.audio, selectedAudioDevice.value);
                }, 200);
            } else {
                // If audio is off but user changed device, we'll start it
                rc.produce(RoomClient.mediaType.audio, selectedAudioDevice.value);
            }
        };

        // Change video device
        const changeVideoDevice = () => {
            if (!rc) return;

            // If 'none' is selected, close the producer if it's active
            if (selectedVideoDevice.value === 'none') {
                if (isVideoOn.value) {
                    rc.closeProducer(RoomClient.mediaType.video);
                }
                return;
            }

            // If video is already on, restart it with the new device
            if (isVideoOn.value) {
                rc.closeProducer(RoomClient.mediaType.video);
                setTimeout(() => {
                    rc.produce(RoomClient.mediaType.video, selectedVideoDevice.value);
                }, 200);
            } else {
                // If video is off but user changed device, we'll start it
                rc.produce(RoomClient.mediaType.video, selectedVideoDevice.value);
            }
        };

        // Copy room URL
        const copyURL = () => {
            const url = `${window.location.origin}${window.location.pathname}?room=${room_id.value}&name=${name.value}`;
            navigator.clipboard.writeText(url).then(() => {
                alert('URL copied to clipboard!');
            }).catch(err => {
                console.error('Could not copy URL: ', err);
            });
        };

        // Exit room
        const exitRoom = () => {
            if (!rc) return;

            rc.exit();
            room_id.value = '';
            showDevicesList.value = false;

            // Clear peers
            Object.keys(peers).forEach(key => {
                delete peers[key];
            });
        };

        // Clean up on component unmount
        onBeforeUnmount(() => {
            if (rc) {
                rc.exit();
            }
        });

        return {
            room,
            name,
            room_id,
            isAudioOn,
            isVideoOn,
            isScreenSharingOn,
            showDevicesList,
            audioDevices,
            videoDevices,
            selectedAudioDevice,
            selectedVideoDevice,
            peers,
            joinRoom,
            toggleAudio,
            toggleVideo,
            toggleScreen,
            showDevices,
            changeAudioDevice,
            changeVideoDevice,
            copyURL,
            exitRoom
        };
    }
});

// Mount the Vue app
app.mount('#app'); 