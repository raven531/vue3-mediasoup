import { defineStore } from 'pinia'
import { io } from 'socket.io-client'

export const useRoomStore = defineStore('room', {
    state: () => ({
        socket: null,
        isConnected: false,
        error: null
    }),

    actions: {
        connect() {
            return new Promise((resolve, reject) => {
                try {
                    this.socket = io(`https://${window.location.hostname}:3016`, {
                        secure: true,
                        rejectUnauthorized: false,
                        reconnection: true,
                        reconnectionAttempts: 5,
                        reconnectionDelay: 1000
                    });

                    this.socket.on('connect', () => {
                        this.isConnected = true;
                        this.error = null;
                        resolve();
                    });

                    this.socket.on('connect_error', (error) => {
                        this.error = error.message;
                        reject(error);
                    });

                    this.socket.on('disconnect', () => {
                        this.isConnected = false;
                    });
                } catch (error) {
                    this.error = error.message;
                    reject(error);
                }
            });
        },

        disconnect() {
            if (this.socket) {
                this.socket.disconnect();
                this.socket = null;
                this.isConnected = false;
            }
        },

        emit(event, data) {
            return new Promise((resolve, reject) => {
                if (!this.socket) {
                    reject(new Error('Socket not connected'));
                    return;
                }

                this.socket.emit(event, data, (response) => {
                    if (response && response.error) {
                        reject(new Error(response.error));
                    } else {
                        resolve(response);
                    }
                });
            });
        },

        on(event, callback) {
            if (this.socket) {
                this.socket.on(event, callback);
            }
        },

        off(event, callback) {
            if (this.socket) {
                this.socket.off(event, callback);
            }
        }
    }
}); 