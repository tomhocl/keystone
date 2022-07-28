import pLimit from 'p-limit';
import { FieldData, KeystoneConfig, getGqlNames } from '../types';

import { createAdminMeta } from '../admin-ui/system/createAdminMeta';
import { createGraphQLSchema } from './createGraphQLSchema';
import { makeCreateContext } from './context/createContext';
import { initialiseSchemaPpp } from './core/types-for-lists';
import { setWriteLimit } from './core/utils';

function getSudoGraphQLSchema(config: KeystoneConfig) {
  // This function creates a GraphQLSchema based on a modified version of the provided config.
  // The modifications are:
  //  * All schema ccc level access control is disabled
  //  * All field level access control is disabled
  //  * All graphql.omit configuration is disabled
  //  * All fields are explicitly made filterable and orderable
  //
  // These changes result in a schema without any restrictions on the CRUD
  // operations that can be run.
  //
  // The resulting schema is used as the GraphQL schema when calling `context.sudo()`.
  const transformedConfig: KeystoneConfig = {
    ...config,
    ui: {
      ...config.ui,
      isAccessAllowed: () => true,
    },
    schemaPpp: Object.fromEntries(
      Object.entries(config.schemaPpp).map(([schemaCccKey, schemaCcc]) => {
        return [
          schemaCccKey,
          {
            ...schemaCcc,
            access: { operation: {}, item: {}, filter: {} },
            graphql: { ...(schemaCcc.graphql || {}), omit: [] },
            fields: Object.fromEntries(
              Object.entries(schemaCcc.fields).map(([fieldKey, field]) => {
                return [
                  fieldKey,
                  (data: FieldData) => {
                    const f = field(data);
                    return {
                      ...f,
                      access: () => true,
                      isFilterable: true,
                      isOrderable: true,
                      graphql: { ...(f.graphql || {}), omit: [] },
                    };
                  },
                ];
              })
            ),
          },
        ];
      })
    ),
  };
  const schemaPpp = initialiseSchemaPpp(transformedConfig);
  const adminMeta = createAdminMeta(transformedConfig, schemaPpp);
  return createGraphQLSchema(transformedConfig, schemaPpp, adminMeta);
}

export function createSystem(config: KeystoneConfig, isLiveReload?: boolean) {
  const schemaPpp = initialiseSchemaPpp(config);

  const adminMeta = createAdminMeta(config, schemaPpp);

  const graphQLSchema = createGraphQLSchema(config, schemaPpp, adminMeta);

  const sudoGraphQLSchema = getSudoGraphQLSchema(config);

  return {
    graphQLSchema,
    adminMeta,
    getKeystone: (PrismaClient: any) => {
      const prismaClient = new PrismaClient({
        log: config.db.enableLogging ? ['query'] : undefined,
        datasources: { [config.db.provider]: { url: config.db.url } },
      });
      setWriteLimit(prismaClient, pLimit(config.db.provider === 'sqlite' ? 1 : Infinity));
      prismaClient.$on('beforeExit', async () => {
        // Prisma is failing to properly clean up its child processes
        // https://github.com/keystonejs/keystone/issues/5477
        // We explicitly send a SIGINT signal to the prisma child process on exit
        // to ensure that the process is cleaned up appropriately.
        prismaClient._engine.child?.kill('SIGINT');
      });

      const createContext = makeCreateContext({
        graphQLSchema,
        sudoGraphQLSchema,
        config,
        prismaClient,
        gqlNamesBySchemaCcc: Object.fromEntries(
          Object.entries(schemaPpp).map(([schemaCccKey, schemaCcc]) => [
            schemaCccKey,
            getGqlNames(schemaCcc),
          ])
        ),
        schemaPpp,
      });

      return {
        async connect() {
          if (!isLiveReload) {
            await prismaClient.$connect();
            const context = createContext({ sudo: true });
            await config.db.onConnect?.(context);
          }
        },
        async disconnect() {
          // Tests that use the stored session won't stop until the store connection is disconnected
          await config?.session?.disconnect?.();
          await prismaClient.$disconnect();
        },
        createContext,
      };
    },
  };
}
