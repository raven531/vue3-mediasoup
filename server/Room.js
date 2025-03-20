const config = require('./config');

module.exports = class Room {
    constructor(room_id, worker, io) {
        this.id = room_id;
        this.worker = worker;
        this.io = io;
        this.peers = new Map();
        this.router = null;

        // Initialize the router
        this._createRouter();
    }

    async _createRouter() {
        try {
            const mediaCodecs = config.mediasoup.router.mediaCodecs;
            this.router = await this.worker.createRouter({ mediaCodecs });
            console.log(`Router created for room ${this.id}`);
        } catch (error) {
            console.error(`Error creating router: ${error}`);
        }
    }

    addPeer(peer) {
        this.peers.set(peer.id, peer);
    }

    getProducerListForPeer() {
        let producerList = [];
        console.log('Getting producer list for peer. Current peers:', this.peers.size);

        this.peers.forEach((peer) => {
            console.log(`Peer ${peer.name} has ${peer.producers.size} producers`);
            peer.producers.forEach((producer) => {
                console.log(`Adding producer ${producer.id} from peer ${peer.name}`);
                producerList.push({
                    producer_id: producer.id,
                    producer_socket_id: peer.id,
                    producer_name: peer.name,
                    kind: producer.kind
                });
            });
        });

        console.log('Final producer list:', producerList);
        return producerList;
    }

    async getRtpCapabilities() {
        // Make sure router is initialized
        if (!this.router) {
            await this._waitForRouter();
        }

        return this.router.rtpCapabilities;
    }

    async _waitForRouter() {
        console.log(`Waiting for router to be created for room ${this.id}...`);

        // Wait for router to be initialized (max 10 seconds)
        for (let i = 0; i < 100; i++) {
            if (this.router) return;
            await new Promise(resolve => setTimeout(resolve, 100));
        }

        if (!this.router) {
            throw new Error('Router initialization timeout');
        }
    }

    async createWebRtcTransport(socket_id) {
        // Make sure router is initialized
        if (!this.router) {
            await this._waitForRouter();
        }

        const { maxIncomingBitrate, initialAvailableOutgoingBitrate } = config.mediasoup.webRtcTransport;

        const transport = await this.router.createWebRtcTransport({
            listenIps: config.mediasoup.webRtcTransport.listenIps,
            enableUdp: true,
            enableTcp: true,
            preferUdp: true,
            initialAvailableOutgoingBitrate
        });

        if (maxIncomingBitrate) {
            try {
                await transport.setMaxIncomingBitrate(maxIncomingBitrate);
            } catch (error) {
                console.error(error);
            }
        }

        // Store the transport in peer's transport map
        if (this.peers.has(socket_id)) {
            this.peers.get(socket_id).addTransport(transport);
        } else {
            console.warn(`Peer with ID ${socket_id} not found when creating transport`);
        }

        transport.on('dtlsstatechange', dtlsState => {
            if (dtlsState === 'closed') {
                console.log('Transport closed', { transportId: transport.id });
                transport.close();
            }
        });

        transport.on('close', () => {
            console.log('Transport closed', { transportId: transport.id });
        });

        console.log('Creating transport', { transportId: transport.id });

        return {
            transport,
            params: {
                id: transport.id,
                iceParameters: transport.iceParameters,
                iceCandidates: transport.iceCandidates,
                dtlsParameters: transport.dtlsParameters
            }
        };
    }

    async connectPeerTransport(socket_id, transport_id, dtlsParameters) {
        if (!this.peers.has(socket_id)) {
            console.warn(`Peer with ID ${socket_id} not found when connecting transport`);
            return;
        }

        await this.peers.get(socket_id).connectTransport(transport_id, dtlsParameters);
    }

    async produce(socket_id, producerTransportId, rtpParameters, kind) {
        // Get the peer using the socket id
        if (!this.peers.has(socket_id)) {
            console.warn(`Peer with ID ${socket_id} not found when producing`);
            throw new Error(`Peer with ID ${socket_id} not found`);
        }

        const peer = this.peers.get(socket_id);

        // Create the producer
        const producer = await peer.createProducer(producerTransportId, rtpParameters, kind);

        // Broadcast the new producer to all other peers
        this.broadCast(socket_id, 'newProducers', [
            {
                producer_id: producer.id,
                producer_socket_id: socket_id
            }
        ]);

        return producer.id;
    }

    async consume(socket_id, consumer_transport_id, producer_id, rtpCapabilities) {
        console.log(`Socket ${socket_id} consuming producer ${producer_id}`);

        // Make sure router is initialized
        if (!this.router) {
            await this._waitForRouter();
        }

        // Get the peer
        if (!this.peers.has(socket_id)) {
            console.warn(`Peer with ID ${socket_id} not found when consuming`);
            throw new Error(`Peer with ID ${socket_id} not found`);
        }

        const peer = this.peers.get(socket_id);
        console.log(`Creating consumer for peer ${peer.name} (${socket_id})`);

        // Find producer
        let producer = null;
        for (let p of this.peers.values()) {
            if (p.producers.has(producer_id)) {
                producer = p.getProducer(producer_id);
                break;
            }
        }

        if (!producer) {
            console.warn(`Producer ${producer_id} not found`);
            throw new Error(`Producer ${producer_id} not found`);
        }

        // Make sure the peer can consume the producer
        if (!this.router.canConsume({
            producerId: producer_id,
            rtpCapabilities
        })) {
            console.error('Cannot consume', {
                socket_id,
                consumer_transport_id,
                producer_id,
                rtpCapabilities
            });
            throw new Error('Cannot consume');
        }

        try {
            // Create the consumer
            const { consumer, params } = await peer.createConsumer(
                consumer_transport_id,
                producer_id,
                rtpCapabilities
            );

            console.log(`Consumer ${consumer.id} created successfully for peer ${peer.name}`);

            return params;
        } catch (error) {
            console.error(`Error creating consumer for peer ${peer.name}:`, error);
            throw error;
        }
    }

    async removePeer(socket_id) {
        if (!this.peers.has(socket_id)) {
            console.warn(`Peer with ID ${socket_id} not found when removing`);
            return;
        }

        this.peers.get(socket_id).close();
        this.peers.delete(socket_id);
    }

    closeProducer(socket_id, producer_id) {
        // Check if peer exists
        if (!this.peers.has(socket_id)) {
            console.warn(`Peer with ID ${socket_id} not found when closing producer`);
            return;
        }

        try {
            const peer = this.peers.get(socket_id);

            // Check if producer exists for this peer
            if (!peer.producers.has(producer_id)) {
                console.warn(`Producer ${producer_id} not found for peer ${socket_id}`);
                return;
            }

            // Close the producer
            peer.closeProducer(producer_id);
            console.log(`Producer ${producer_id} closed for peer ${socket_id}`);
        } catch (error) {
            console.error(`Error closing producer ${producer_id}:`, error);
        }
    }

    broadCast(socket_id, name, data) {
        for (let otherPeer of this.peers.values()) {
            if (otherPeer.id !== socket_id) {
                this.send(otherPeer.id, name, data);
            }
        }
    }

    send(socket_id, name, data) {
        this.io.to(socket_id).emit(name, data);
    }

    getPeers() {
        return this.peers;
    }

    toJson() {
        return {
            id: this.id,
            peers: JSON.stringify([...this.peers])
        };
    }
}; 