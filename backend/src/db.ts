import type { Db } from 'mongodb';

const COLLECTION = 'todos';

const options = {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['desc', 'status', 'createdAt'],
      additionalProperties: false,
      properties: {
        _id: { bsonType: 'objectId' },
        desc: { bsonType: 'string', minLength: 1, maxLength: 500 },
        // "act" = active, "inv" = inactive (completed)
        status: { enum: ['act', 'inv'] },
        createdAt: { bsonType: 'date' },
      },
    },
  },
  validationLevel: 'strict',
  validationAction: 'error',
} as const;

const NAMESPACE_EXISTS = 48;

export async function ensureTodosCollection(db: Db): Promise<void> {
  try {
    await db.createCollection(COLLECTION, options);
  } catch (error) {
    if ((error as { code?: number }).code !== NAMESPACE_EXISTS) {
      throw error;
    }
    await db.command({ collMod: COLLECTION, ...options });
  }
  await db.collection(COLLECTION).createIndex({ status: 1, createdAt: 1 });
}
