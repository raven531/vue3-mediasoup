<template>
    <div class="room">
        <div class="container">
            <div id="control">
                <button id="exitButton" @click="leaveRoom">
                    <i class="fas fa-arrow-left"></i> Exit
                </button>
                <button id="copyButton" @click="copyURL">
                    <i class="far fa-copy"></i> copy URL
                </button>
                <button id="devicesButton" @click="toggleDevices">
                    <i class="fas fa-cogs"></i> Devices
                </button>
                <button v-if="!isAudioEnabled" @click="toggleAudio">
                    <i class="fas fa-microphone"></i> Open audio
                </button>
                <button v-if="isAudioEnabled" @click="toggleAudio">
                    <i class="fas fa-microphone"></i> Close audio
                </button>
                <button v-if="!isVideoEnabled" @click="toggleVideo">
                    <i class="fas fa-camera"></i> Open video
                </button>
                <button v-if="isVideoEnabled" @click="toggleVideo">
                    <i class="fas fa-camera"></i> Close video
                </button>
                <button v-if="!isScreenSharing" @click="toggleScreen">
                    <i class="fas fa-desktop"></i> Open screen
                </button>
                <button v-if="isScreenSharing" @click="toggleScreen">
                    <i class="fas fa-desktop"></i> Close screen
                </button>
                <br><br>
                <div id="devicesList" :class="{ hidden: !showDevices }">
                    <i class="fas fa-microphone"></i> Audio:
                    <select id="audioSelect" class="form-select" style="width: auto" v-model="selectedAudioDevice"
                        @change="changeAudioDevice"></select>
                    <br>
                    <i class="fas fa-video"></i> Video:
                    <select id="videoSelect" class="form-select" style="width: auto" v-model="selectedVideoDevice"
                        @change="changeVideoDevice"></select>
                </div>
                <br>
            </div>
        </div>

        <div class="container">
            <div id="videoMedia">
                <h4><i class="fab fa-youtube"></i> Local media</h4>
                <div id="localMedia" class="containers">
                    <!-- Local videos will be appended here by RoomClient.js -->
                </div>
                <br>
                <h4><i class="fab fa-youtube"></i> Remote media</h4>
                <div id="remoteVideos" class="containers">
                    <!-- Remote videos will be appended here by RoomClient.js -->
                </div>
                <div id="remoteAudios">
                    <!-- Remote audios will be appended here by RoomClient.js -->
                </div>
            </div>
        </div>
    </div>
</template>

<script>
import { useRouter, useRoute } from 'vue-router';
import { ref, onMounted, onBeforeUnmount } from 'vue';

export default {
    name: 'Room',
    setup() {
        const router = useRouter();
        const route = useRoute();

        const roomId = ref(route.params.id || '123');
        const username = ref(route.query.name || 'user');

        // States
        const isAudioEnabled = ref(false);
        const isVideoEnabled = ref(false);
        const isScreenSharing = ref(false);
        const showDevices = ref(false);

        const selectedAudioDevice = ref('');
        const selectedVideoDevice = ref('');

        // Reference to RoomClient (created in vue3-app.js)
        let rc = null;

        onMounted(() => {
            // The RoomClient instance is created and managed by vue3-app.js
            // We just need to use the existing window.rc instance

            // Set up event listeners to sync state
            if (window.rc) {
                rc = window.rc;

                // Update local state based on RoomClient events
                rc.on(RoomClient.EVENTS.startAudio, () => {
                    isAudioEnabled.value = true;
                });

                rc.on(RoomClient.EVENTS.stopAudio, () => {
                    isAudioEnabled.value = false;
                });

                rc.on(RoomClient.EVENTS.startVideo, () => {
                    isVideoEnabled.value = true;
                });

                rc.on(RoomClient.EVENTS.stopVideo, () => {
                    isVideoEnabled.value = false;
                });

                rc.on(RoomClient.EVENTS.startScreen, () => {
                    isScreenSharing.value = true;
                });

                rc.on(RoomClient.EVENTS.stopScreen, () => {
                    isScreenSharing.value = false;
                });
            }

            // Load available devices
            loadDevices();
        });

        onBeforeUnmount(() => {
            // Clean up any event listeners if needed
        });

        // Functions
        const toggleAudio = () => {
            if (!rc) return;

            if (isAudioEnabled.value) {
                rc.closeProducer(RoomClient.mediaType.audio);
            } else {
                rc.produce(RoomClient.mediaType.audio, selectedAudioDevice.value);
            }
        };

        const toggleVideo = () => {
            if (!rc) return;

            if (isVideoEnabled.value) {
                rc.closeProducer(RoomClient.mediaType.video);
            } else {
                rc.produce(RoomClient.mediaType.video, selectedVideoDevice.value);
            }
        };

        const toggleScreen = () => {
            if (!rc) return;

            if (isScreenSharing.value) {
                rc.closeProducer(RoomClient.mediaType.screen);
            } else {
                rc.produce(RoomClient.mediaType.screen);
            }
        };

        const toggleDevices = () => {
            showDevices.value = !showDevices.value;
        };

        const changeAudioDevice = () => {
            if (!rc || !isAudioEnabled.value) return;

            rc.closeProducer(RoomClient.mediaType.audio);
            setTimeout(() => {
                rc.produce(RoomClient.mediaType.audio, selectedAudioDevice.value);
            }, 200);
        };

        const changeVideoDevice = () => {
            if (!rc || !isVideoEnabled.value) return;

            rc.closeProducer(RoomClient.mediaType.video);
            setTimeout(() => {
                rc.produce(RoomClient.mediaType.video, selectedVideoDevice.value);
            }, 200);
        };

        const loadDevices = async () => {
            try {
                const devices = await navigator.mediaDevices.enumerateDevices();

                const audioDevices = devices.filter(device => device.kind === 'audioinput');
                const videoDevices = devices.filter(device => device.kind === 'videoinput');

                // Populate select elements
                const audioSelect = document.getElementById('audioSelect');
                const videoSelect = document.getElementById('videoSelect');

                if (audioSelect) {
                    audioSelect.innerHTML = '';
                    audioDevices.forEach(device => {
                        const option = document.createElement('option');
                        option.value = device.deviceId;
                        option.text = device.label || `Microphone ${audioSelect.length + 1}`;
                        audioSelect.appendChild(option);
                    });

                    if (audioDevices.length > 0) {
                        selectedAudioDevice.value = audioDevices[0].deviceId;
                    }
                }

                if (videoSelect) {
                    videoSelect.innerHTML = '';
                    videoDevices.forEach(device => {
                        const option = document.createElement('option');
                        option.value = device.deviceId;
                        option.text = device.label || `Camera ${videoSelect.length + 1}`;
                        videoSelect.appendChild(option);
                    });

                    if (videoDevices.length > 0) {
                        selectedVideoDevice.value = videoDevices[0].deviceId;
                    }
                }
            } catch (error) {
                console.error('Error loading devices:', error);
            }
        };

        const copyURL = () => {
            const url = `${window.location.origin}${window.location.pathname}?room=${roomId.value}&name=${username.value}`;
            navigator.clipboard.writeText(url).then(() => {
                alert('URL copied to clipboard!');
            }).catch(err => {
                console.error('Could not copy URL: ', err);
            });
        };

        const leaveRoom = () => {
            if (rc) {
                rc.exit();
            }
            router.push('/');
        };

        return {
            roomId,
            username,
            isAudioEnabled,
            isVideoEnabled,
            isScreenSharing,
            showDevices,
            selectedAudioDevice,
            selectedVideoDevice,
            toggleAudio,
            toggleVideo,
            toggleScreen,
            toggleDevices,
            changeAudioDevice,
            changeVideoDevice,
            copyURL,
            leaveRoom
        };
    }
}
</script>

<style scoped>
/* Room-specific styles */
.room {
    padding: 20px 0;
}

#control {
    margin: 20px 0;
    width: 100%;
}

/* This ensures we're using the styles from main.css */
</style>