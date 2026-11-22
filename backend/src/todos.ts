import { Router } from 'express';
import { Collection, ObjectId, type WithId } from 'mongodb';
import type { PublishEvent } from './kafka.js';

/** "act" = active, "inv" = inactive (completed) */
export type TodoStatus = 'act' | 'inv';

export interface TodoDoc {
  desc: string;
  status: TodoStatus;
  createdAt: Date;
}

export interface TodoDto {
  id: string;
  desc: string;
  status: TodoStatus;
}

const MAX_DESC_LENGTH = 500;

const toDto = (doc: WithId<TodoDoc>): TodoDto => ({
  id: doc._id.toHexString(),
  desc: doc.desc,
  status: doc.status,
});

const isStatus = (value: unknown): value is TodoStatus => value === 'act' || value === 'inv';
const isId = (value: string): boolean => /^[0-9a-f]{24}$/i.test(value);

export function createTodosRouter(todos: Collection<TodoDoc>, publish: PublishEvent): Router {
  const router = Router();

  router.get('/', async (req, res) => {
    const status = req.query['status'];
    if (status !== undefined && !isStatus(status)) {
      res.status(400).json({ error: 'status must be "act" or "inv"' });
      return;
    }
    const docs = await todos
      .find(status === undefined ? {} : { status })
      .sort({ createdAt: 1, _id: 1 })
      .toArray();
    res.json(docs.map(toDto));
  });

  router.post('/', async (req, res) => {
    const desc: unknown = req.body?.desc;
    if (typeof desc !== 'string' || desc.trim() === '' || desc.trim().length > MAX_DESC_LENGTH) {
      res.status(400).json({ error: `desc must be a non-empty string up to ${MAX_DESC_LENGTH} characters` });
      return;
    }
    const doc = { desc: desc.trim(), status: 'act' as const, createdAt: new Date() };
    const { insertedId } = await todos.insertOne(doc);
    await publish({ type: 'created', id: insertedId.toHexString(), desc: doc.desc, status: doc.status });
    res.status(201).json(toDto({ _id: insertedId, ...doc }));
  });

  router.patch('/:id', async (req, res) => {
    const id = req.params['id'] ?? '';
    const status: unknown = req.body?.status;
    if (!isId(id)) {
      res.status(400).json({ error: 'invalid id' });
      return;
    }
    if (!isStatus(status)) {
      res.status(400).json({ error: 'status must be "act" or "inv"' });
      return;
    }
    const updated = await todos.findOneAndUpdate(
      { _id: new ObjectId(id) },
      { $set: { status } },
      { returnDocument: 'after' },
    );
    if (!updated) {
      res.status(404).json({ error: 'todo not found' });
      return;
    }
    await publish({ type: 'updated', id, desc: updated.desc, status: updated.status });
    res.json(toDto(updated));
  });

  router.delete('/:id', async (req, res) => {
    const id = req.params['id'] ?? '';
    if (!isId(id)) {
      res.status(400).json({ error: 'invalid id' });
      return;
    }
    const { deletedCount } = await todos.deleteOne({ _id: new ObjectId(id) });
    if (deletedCount > 0) await publish({ type: 'deleted', id });
    res.sendStatus(deletedCount === 0 ? 404 : 204);
  });

  router.delete('/', async (req, res) => {
    const status = req.query['status'];
    if (!isStatus(status)) {
      res.status(400).json({ error: 'status query parameter ("act" or "inv") is required' });
      return;
    }
    await todos.deleteMany({ status });
    res.sendStatus(204);
  });

  return router;
}
