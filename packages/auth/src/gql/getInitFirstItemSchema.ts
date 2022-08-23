import { graphql } from '@keystone-6/core';
import { BaseItem } from '@keystone-6/core/types';
import { assertInputObjectType, GraphQLInputObjectType, GraphQLSchema } from 'graphql';

import { AuthGqlNames, getListDbAPI, InitFirstItemConfig } from '../types';

export function getInitFirstItemSchema({
  modelKey,
  fields,
  itemData,
  gqlNames,
  graphQLSchema,
  ItemAuthenticationWithPasswordSuccess,
}: {
  modelKey: string;
  fields: InitFirstItemConfig<any>['fields'];
  itemData: InitFirstItemConfig<any>['itemData'];
  gqlNames: AuthGqlNames;
  graphQLSchema: GraphQLSchema;
  ItemAuthenticationWithPasswordSuccess: graphql.ObjectType<{
    item: BaseItem;
    sessionToken: string;
  }>;
}) {
  const createInputConfig = assertInputObjectType(
    graphQLSchema.getType(`${modelKey}CreateInput`)
  ).toConfig();
  const fieldsSet = new Set(fields);
  const initialCreateInput = graphql.wrap.inputObject(
    new GraphQLInputObjectType({
      ...createInputConfig,
      fields: Object.fromEntries(
        Object.entries(createInputConfig.fields).filter(([fieldKey]) => fieldsSet.has(fieldKey))
      ),
      name: gqlNames.CreateInitialInput,
    })
  );
  return {
    mutation: {
      [gqlNames.createInitialItem]: graphql.field({
        type: graphql.nonNull(ItemAuthenticationWithPasswordSuccess),
        args: { data: graphql.arg({ type: graphql.nonNull(initialCreateInput) }) },
        async resolve(rootVal, { data }, context) {
          if (!context.startSession) {
            throw new Error('No session implementation available on context');
          }

          const db = getListDbAPI(context.sudo(), modelKey);
          const count = await db.count({});
          if (count !== 0) {
            throw new Error('Initial items can only be created when no items exist in that list');
          }

          // Update system state
          // this is strictly speaking incorrect. the db API will do GraphQL coercion on a value which has already been coerced
          // (this is also mostly fine, the chance that people are using things where
          // the input value can't round-trip like the Upload scalar here is quite low)
          const item = await db.createOne({ data: { ...data, ...itemData } });
          const sessionToken = await context.startSession({
            listKey: modelKey,
            itemId: item.id.toString(),
          });
          return { item, sessionToken };
        },
      }),
    },
  };
}
