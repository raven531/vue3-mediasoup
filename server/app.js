const express = require('express');
const app = express();
const https = require('httpolyglot');
const fs = require('fs');
const mediasoup = require('mediasoup');
const path = require('path');
const config = require('./config');

// Import Room and Peer classes
const Room = require('./Room');
const Peer = require('./Peer');

// SSL certificates for HTTPS
const options = {
    key: fs.readFileSync(path.join(__dirname, '..', 'ssl', 'key.pem'), 'utf-8'),
    cert: fs.readFileSync(path.join(__dirname, '..', 'ssl', 'cert.pem'), 'utf-8')
};

const httpsServer = https.createServer(options, app);
const io = require('socket.io')(httpsServer);

// Serve static files from the public directory
app.use(express.static(path.join(__dirname, '..', 'public')));

httpsServer.listen(config.listenPort, () => {
    console.log('Listening on https://' + config.listenIp + ':' + config.listenPort);
});

// all mediasoup workers
let workers = [];
let nextMediasoupWorkerIdx = 0;

/**
 * roomList
 * {
 *  room_id: Room {
 *      id:
 *      router:
 *      peers: {
 *          id:,
 *          name:,
 *          master: [boolean],
 *          transports: [Map],
 *          producers: [Map],
 *          consumers: [Map],
 *          rtpCapabilities:
 *      }
 *  }
 * }
 */
let roomList = new Map();

(async () => {
    await createWorkers();
})();

async function createWorkers() {
    const { numWorkers } = config.mediasoup;

    for (let i = 0; i < numWorkers; i++) {
        const worker = await mediasoup.createWorker({
            logLevel: config.mediasoup.worker.logLevel,
            logTags: config.mediasoup.worker.logTags,
            rtcMinPort: config.mediasoup.worker.rtcMinPort,
            rtcMaxPort: config.mediasoup.worker.rtcMaxPort,
        });

        worker.on('died', () => {
            console.error('mediasoup worker died, exiting in 2 seconds... [pid:%d]', worker.pid);
            setTimeout(() => process.exit(1), 2000);
        });

        workers.push(worker);
    }
}

io.on('connection', (socket) => {
    socket.on('createRoom', async ({ room_id }, callback) => {
        if (roomList.has(room_id)) {
            callback('already exists');
        } else {
            console.log('Created room', { room_id });
            let worker = getMediasoupWorker();
            roomList.set(room_id, new Room(room_id, worker, io));
            callback(room_id);
        }
    });

    socket.on('join', ({ room_id, name }, callback) => {
        console.log('User joined', { room_id, name });

        if (!roomList.has(room_id)) {
            callback({
                error: 'Room does not exist'
            });
            return;
        }

        roomList.get(room_id).addPeer(new Peer(socket.id, name));
        socket.room_id = room_id;

        callback(roomList.get(room_id).toJson());
    });

    socket.on('getProducers', () => {
        if (!socket.room_id) return;

        console.log('Get producers', { name: `${roomList.get(socket.room_id).getPeers().get(socket.id).name}` });

        // Send all the current producers to the newly joined peer
        let producerList = roomList.get(socket.room_id).getProducerListForPeer();

        socket.emit('newProducers', producerList);
    });

    socket.on('getRouterRtpCapabilities', async (_, callback) => {
        try {
            console.log('Get RouterRtpCapabilities', {
                room_id: socket.room_id
            });

            if (!socket.room_id || !roomList.has(socket.room_id)) {
                callback({ error: 'Room not found' });
                return;
            }

            const rtpCapabilities = await roomList.get(socket.room_id).getRtpCapabilities();
            callback(rtpCapabilities);
        } catch (error) {
            console.error('Error getting RTP capabilities:', error);
            callback({ error: error.message });
        }
    });

    socket.on('createWebRtcTransport', async (_, callback) => {
        console.log('Create WebRtc Transport', {
            name: `${roomList.get(socket.room_id).getPeers().get(socket.id).name}`
        });

        try {
            const { transport, params } = await roomList.get(socket.room_id).createWebRtcTransport(socket.id);

            transport.observer.on('close', () => {
                console.log('Transport closed');
            });

            callback(params);
        } catch (err) {
            console.error(err);
            callback({
                error: err.message
            });
        }
    });

    socket.on('connectTransport', async ({ transport_id, dtlsParameters }, callback) => {
        console.log('Connect transport', {
            name: `${roomList.get(socket.room_id).getPeers().get(socket.id).name}`
        });

        if (!roomList.has(socket.room_id)) return;

        await roomList.get(socket.room_id).connectPeerTransport(socket.id, transport_id, dtlsParameters);

        callback('success');
    });

    socket.on('produce', async ({ kind, rtpParameters, producerTransportId }, callback) => {
        if (!roomList.has(socket.room_id)) {
            return callback({ error: 'Room not found' });
        }

        let producer_id = await roomList.get(socket.room_id).produce(
            socket.id,
            producerTransportId,
            rtpParameters,
            kind
        );

        console.log('Produce', {
            type: `${kind}`,
            name: `${roomList.get(socket.room_id).getPeers().get(socket.id).name}`,
            id: `${producer_id}`
        });

        callback({
            producer_id
        });
    });

    socket.on('consume', async ({ consumerTransportId, producerId, rtpCapabilities }, callback) => {
        // TODO null handling
        let params = await roomList.get(socket.room_id).consume(
            socket.id,
            consumerTransportId,
            producerId,
            rtpCapabilities
        );

        console.log('Consuming', {
            name: `${roomList.get(socket.room_id) && roomList.get(socket.room_id).getPeers().get(socket.id).name}`,
            producer_id: `${producerId}`,
            consumer_id: `${params.id}`
        });

        callback(params);
    });

    socket.on('resume', async ({ consumer_id }, callback) => {
        try {
            // Make sure the room and peer exist
            if (!socket.room_id || !roomList.has(socket.room_id)) {
                callback({ error: 'Room not found' });
                return;
            }

            const room = roomList.get(socket.room_id);
            const peer = room.getPeers().get(socket.id);

            if (!peer) {
                callback({ error: 'Peer not found' });
                return;
            }

            // Use the peer's resumeConsumer method
            await peer.resumeConsumer(consumer_id);
            callback('success');
        } catch (error) {
            console.error('Error resuming consumer:', error);
            callback({ error: error.message });
        }
    });

    socket.on('getMyRoomInfo', (_, cb) => {
        cb(roomList.get(socket.room_id).toJson());
    });

    socket.on('disconnect', () => {
        console.log('Disconnect', {
            name: `${roomList.get(socket.room_id) && roomList.get(socket.room_id).getPeers().get(socket.id).name}`
        });

        if (!socket.room_id) return;

        roomList.get(socket.room_id).removePeer(socket.id);
    });

    socket.on('producerClosed', ({ producer_id }) => {
        console.log('Producer close', {
            name: `${roomList.get(socket.room_id) && roomList.get(socket.room_id).getPeers().get(socket.id).name}`
        });

        roomList.get(socket.room_id).closeProducer(socket.id, producer_id);
    });

    socket.on('exitRoom', async (_, callback) => {
        console.log('Exit room', {
            name: `${roomList.get(socket.room_id) && roomList.get(socket.room_id).getPeers().get(socket.id).name}`
        });

        if (!socket.room_id) {
            callback({
                error: 'Not currently in a room'
            });
            return;
        }

        // Close peer's transports
        await roomList.get(socket.room_id).removePeer(socket.id);

        if (roomList.get(socket.room_id).getPeers().size === 0) {
            roomList.delete(socket.room_id);
        }

        socket.room_id = null;

        callback('success');
    });
});

function room() {
    return Object.values(roomList);
}

function getMediasoupWorker() {
    const worker = workers[nextMediasoupWorkerIdx];

    if (++nextMediasoupWorkerIdx === workers.length) {
        nextMediasoupWorkerIdx = 0;
    }

    return worker;
}

module.exports = {
    app,
    io,
    roomList,
    getMediasoupWorker
}; 