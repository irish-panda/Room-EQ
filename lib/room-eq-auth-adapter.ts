import { createAdapterFactory } from "better-auth/adapters";
import { roomEqGateway } from "./room-eq-gateway";

export function roomEqAuthAdapter() {
  const factory = createAdapterFactory({
    config: {
      adapterId: "room-eq-gateway",
      adapterName: "Room EQ Supabase Gateway",
      usePlural: false,
      supportsBooleans: true,
      supportsDates: false,
      supportsJSON: true,
      supportsArrays: false,
      supportsUUIDs: true,
      transaction: false,
    },
    adapter: () => ({
      create: async ({ model, data }) =>
        roomEqGateway({
          kind: "auth",
          operation: "create",
          model,
          payload: { data },
        }),
      findOne: async ({ model, where }) =>
        roomEqGateway({
          kind: "auth",
          operation: "findOne",
          model,
          payload: { where },
        }),
      findMany: async ({ model, where, limit, sortBy, offset }) =>
        roomEqGateway({
          kind: "auth",
          operation: "findMany",
          model,
          payload: { where, limit, sortBy, offset },
        }),
      count: async ({ model, where }) =>
        roomEqGateway<number>({
          kind: "auth",
          operation: "count",
          model,
          payload: { where },
        }),
      update: async ({ model, where, update }) =>
        roomEqGateway({
          kind: "auth",
          operation: "update",
          model,
          payload: { where, update },
        }),
      updateMany: async ({ model, where, update }) =>
        roomEqGateway<number>({
          kind: "auth",
          operation: "updateMany",
          model,
          payload: { where, update },
        }),
      delete: async ({ model, where }) => {
        await roomEqGateway({
          kind: "auth",
          operation: "delete",
          model,
          payload: { where },
        });
      },
      deleteMany: async ({ model, where }) =>
        roomEqGateway<number>({
          kind: "auth",
          operation: "deleteMany",
          model,
          payload: { where },
        }),
      consumeOne: async ({ model, where }) =>
        roomEqGateway({
          kind: "auth",
          operation: "consumeOne",
          model,
          payload: { where },
        }),
      incrementOne: async ({ model, where, increment, set }) =>
        roomEqGateway({
          kind: "auth",
          operation: "incrementOne",
          model,
          payload: { where, increment, set },
        }),
    }),
  });

  return (options: Parameters<typeof factory>[0]) => factory(options);
}
