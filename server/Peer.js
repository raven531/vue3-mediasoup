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
            console.error(`Consumer transport with id ${consumer_transport_id} not found for peer ${this.id}`);
            throw new Error(`Consumer transport with id ${consumer_transport_id} not found`);
        }

        console.log(`Creating consumer for peer ${this.name} on transport ${consumer_transport_id}`);

        let consumer = null;
        try {
            consumer = await consumerTransport.consume({
                producerId: producer_id,
                rtpCapabilities,
                paused: true // Set paused to true so we can call resume once we've created it
            });
            console.log(`Consumer ${consumer.id} created successfully for peer ${this.name}`);
        } catch (error) {
            console.error(`Failed to create consumer for peer ${this.name}:`, error);
            throw error;
        }

        this.consumers.set(consumer.id, consumer);
        console.log(`Peer ${this.name} now has ${this.consumers.size} consumers`);

        consumer.on(
            'transportclose',
            function () {
                console.log('Consumer transport close', {
                    name: `${this.name}`,
                    consumer_id: `${consumer.id}`,
                    transport_id: consumer_transport_id
                });
                this.consumers.delete(consumer.id);
                console.log(`Consumer ${consumer.id} removed from peer ${this.name}`);
            }.bind(this)
        );

        consumer.on(
            'producerclose',
            function () {
                console.log('Consumer producer close', {
                    name: `${this.name}`,
                    consumer_id: `${consumer.id}`,
                    producer_id: producer_id
                });
                this.consumers.delete(consumer.id);
                console.log(`Consumer ${consumer.id} removed from peer ${this.name}`);
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
            console.error(`Consumer with id ${consumer_id} not found for peer ${this.name}`);
            throw new Error(`Consumer with id ${consumer_id} not found`);
        }

        try {
            const consumer = this.consumers.get(consumer_id);
            console.log(`Resuming consumer ${consumer_id} for peer ${this.name}`);
            await consumer.resume();
            console.log(`Consumer ${consumer_id} resumed successfully for peer ${this.name}`);
            return consumer;
        } catch (error) {
            console.error(`Error resuming consumer ${consumer_id} for peer ${this.name}:`, error);
            throw error;
        }
    }

    closeProducer(producer_id) {
        // Check if producer exists
        if (!this.producers.has(producer_id)) {
            console.warn(`Producer ${producer_id} not found for peer ${this.id}`);
            return;
        }

        try {
            // Get the producer and close it
            const producer = this.producers.get(producer_id);
            producer.close();
            console.log(`Producer ${producer_id} closed for peer ${this.id}`);
        } catch (error) {
            console.error(`Error closing producer ${producer_id}:`, error);
        }

        // Always remove from the map, even if there was an error
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