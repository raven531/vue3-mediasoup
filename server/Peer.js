module.exports = class Peer {
    constructor(socket_id, name) {
        this.id = socket_id;
        this.name = name;
        this.transports = new Map();
        this.consumers = new Map();
        this.producers = new Map();
    }

    addTransport(transport) {
        this.transports.set(transport.id, transport);
    }

    async connectTransport(transport_id, dtlsParameters) {
        if (!this.transports.has(transport_id)) return;

        await this.transports.get(transport_id).connect({
            dtlsParameters: dtlsParameters
        });
    }

    async createProducer(producerTransportId, rtpParameters, kind) {
        // Check if transport exists
        if (!this.transports.has(producerTransportId)) {
            console.error(`Transport with id ${producerTransportId} not found`);
            throw new Error(`Transport with id ${producerTransportId} not found`);
        }

        const transport = this.transports.get(producerTransportId);

        if (!transport) {
            console.error(`Transport is null or undefined`);
            throw new Error(`Transport is null or undefined`);
        }

        // Create producer
        let producer = await transport.produce({
            kind,
            rtpParameters
        });

        this.producers.set(producer.id, producer);

        producer.on(
            'transportclose',
            function () {
                console.log('Producer transport close', { name: `${this.name}`, consumer_id: `${producer.id}` });
                producer.close();
                this.producers.delete(producer.id);
            }.bind(this)
        );

        return producer;
    }

    async createConsumer(consumer_transport_id, producer_id, rtpCapabilities) {
        let consumerTransport = this.transports.get(consumer_transport_id);

        if (!consumerTransport) {
            console.error(`Consumer transport with id ${consumer_transport_id} not found`);
            throw new Error(`Consumer transport with id ${consumer_transport_id} not found`);
        }

        let consumer = null;
        try {
            consumer = await consumerTransport.consume({
                producerId: producer_id,
                rtpCapabilities,
                paused: true // Set paused to true so we can call resume once we've created it
            });
        } catch (error) {
            console.error('Consume failed', error);
            return;
        }

        this.consumers.set(consumer.id, consumer);

        consumer.on(
            'transportclose',
            function () {
                console.log('Consumer transport close', { name: `${this.name}`, consumer_id: `${consumer.id}` });
                this.consumers.delete(consumer.id);
            }.bind(this)
        );

        consumer.on(
            'producerclose',
            function () {
                console.log('Consumer producer close', { name: `${this.name}`, consumer_id: `${consumer.id}` });
                this.consumers.delete(consumer.id);
            }.bind(this)
        );

        return {
            consumer,
            params: {
                producerId: producer_id,
                id: consumer.id,
                kind: consumer.kind,
                rtpParameters: consumer.rtpParameters,
                type: consumer.type,
                producerPaused: consumer.producerPaused
            }
        };
    }

    async resumeConsumer(consumer_id) {
        if (!this.consumers.has(consumer_id)) {
            console.error(`Consumer with id ${consumer_id} not found`);
            throw new Error(`Consumer with id ${consumer_id} not found`);
        }

        const consumer = this.consumers.get(consumer_id);
        await consumer.resume();
        return consumer;
    }

    closeProducer(producer_id) {
        try {
            this.producers.get(producer_id).close();
        } catch (e) {
            console.warn(e);
        }

        this.producers.delete(producer_id);
    }

    getProducer(producer_id) {
        return this.producers.get(producer_id);
    }

    close() {
        this.transports.forEach(transport => transport.close());
    }

    removeConsumer(consumer_id) {
        this.consumers.delete(consumer_id);
    }
}; 