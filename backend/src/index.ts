import express, { type NextFunction, type Request, type Response } from 'express';
import { MongoClient } from 'mongodb';
import { ensureTodosCollection } from './db.js';
import { startKafka, stopKafka } from './kafka.js';
import { createTodosRouter, type TodoDoc } from './todos.js';

const port = 3000;
const mongoUrl = 'mongodb://mongo:27017/todoapp';

const client = new MongoClient(mongoUrl, { serverSelectionTimeoutMS: 5000 });
try {
  await client.connect();
} catch (error) {
  console.error(`Cannot connect to MongoDB at ${mongoUrl}. Is the mongo container running?`);
  console.error(error);
  process.exit(1);
}
const db = client.db(); // database name comes from the connection URL ("todoapp")
await ensureTodosCollection(db);
const publish = await startKafka();

const app = express();
app.use(express.json());

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});
app.use('/api/todos', createTodosRouter(db.collection<TodoDoc>('todos'), publish));

// Express 5 forwards errors from async handlers here
app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
  console.error(error);
  res.status(500).json({ error: 'internal server error' });
});

const server = app.listen(port, () => {
  console.log(`API listening on http://localhost:${port}`);
});

async function shutdown(): Promise<void> {
  server.close();
  await stopKafka();
  await client.close();
  process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
