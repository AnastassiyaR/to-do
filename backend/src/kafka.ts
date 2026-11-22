import { Kafka, logLevel, type Producer } from 'kafkajs';

export const TOPIC = 'todos';

export interface TodoEvent {
    type: 'created' | 'updated' | 'deleted';
    id: string;
    desc?: string;
    status?: string;
    at: string;
}

export type PublishEvent = (event: Omit<TodoEvent, 'at'>) => Promise<void>;

const brokers = ['kafka:9092'];
const kafka = new Kafka({ clientId: 'todolist-backend', brokers, logLevel: logLevel.WARN });

let producer: Producer | undefined;

/**
 * Starts the producer and a consumer that logs every event.
 * If Kafka is unavailable the API keeps working, events are just not sent.
 */
export async function startKafka(): Promise<PublishEvent> {
    try {
        const admin = kafka.admin();
        await admin.connect();
        await admin.createTopics({ topics: [{ topic: TOPIC, numPartitions: 1 }] });
        await admin.disconnect();

        producer = kafka.producer();
        await producer.connect();

        const consumer = kafka.consumer({ groupId: 'todolist-logger' });
        await consumer.connect();
        await consumer.subscribe({ topic: TOPIC, fromBeginning: true });
        await consumer.run({
            eachMessage: async ({ message }) => {
                console.log('[kafka] received:', message.value?.toString());
            },
        });
        console.log(`Kafka connected (${brokers.join(',')}), topic "${TOPIC}"`);
    } catch (error) {
        producer = undefined;
        console.error(`Kafka unavailable at ${brokers.join(',')}, continuing without it.`, error);
    }

    return async (event) => {
        if (!producer) return;
        const payload: TodoEvent = { ...event, at: new Date().toISOString() };
        try {
            await producer.send({ topic: TOPIC, messages: [{ key: event.id, value: JSON.stringify(payload) }] });
        } catch (error) {
            console.error('[kafka] failed to send event', error);
        }
    };
}

export async function stopKafka(): Promise<void> {
    await producer?.disconnect().catch(() => undefined);
}
