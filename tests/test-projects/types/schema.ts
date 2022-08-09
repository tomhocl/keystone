import { list, graphql } from '@keystone-6/core';
import { BaseListTypeInfo, ListOperationAccessControl } from '@keystone-6/core/types';
import { checkbox, relationship, text, timestamp, virtual, select } from '@keystone-6/core/fields';
import { Lists, Context } from '.keystone/types';

export type GenericListAccessChecker = ListOperationAccessControl<
  'create' | 'query' | 'delete' | 'update',
  // Would be nice to have a more specific generic to use here, so context is typed
  BaseListTypeInfo
>;

const genericAccessCheck: GenericListAccessChecker = async ({
  session,
  listKey,
  operation,
  context: _context,
}) => {
  // This is to get around the fact that the context type is not being inferred correctly
  const context = _context as Context;
  const tasks = await context.db.Task.findMany({
    where: { assignedTo: { id: session.itemId } },
  });
  if (tasks.length === 0 && operation === 'query' && listKey === 'Task') {
    return false;
  }
  return !!session;
};

export const lists: Lists = {
  Task: list({
    // Comment out the access control and the types are inferred correctly
    access: {
      operation: {
        query: genericAccessCheck,
        create: genericAccessCheck,
        delete: genericAccessCheck,
      },
    },
    fields: {
      label: text({ validation: { isRequired: true } }),
      priority: select({
        type: 'enum',
        options: [
          { label: 'Low', value: 'low' },
          { label: 'Medium', value: 'medium' },
          { label: 'High', value: 'high' },
        ],
      }),
      isComplete: checkbox(),
      assignedTo: relationship({ ref: 'Person.tasks', many: false }),
      finishBy: timestamp({
        access: {
          create: async ({ session, context, inputData }) => {
            // All types here are generic unless genericAccessCheck is not used on the list
            const { isComplete } = inputData;
            const tasks = await context.db.Task.findMany({
              where: { assignedTo: { id: session.itemId } },
            });
            // The type for isComplete is boolean | undefined so this should be a type error
            return isComplete && tasks.length > 0;
          },
        },
      }),
      status: virtual({
        field: graphql.field({
          type: graphql.String,
          resolve: async (item, args, context) => {
            // All types here are generic unless genericAccessCheck is not used on the list
            const { isComplete, finishBy } = item;
            const assignedTo = await context.query.Person.findOne({
              // @ts-expect-error The generic assignedTo type is unknown this should not be a type error
              where: { id: item.assignedToId },
              query: 'name',
            });

            return `${assignedTo.name} has ${
              isComplete ? 'done' : 'not done'
            } the task to be completed by ${finishBy}`;
          },
        }),
      }),
    },
  }),
  Person: list({
    access: {
      operation: {
        query: genericAccessCheck,
        create: genericAccessCheck,
        delete: genericAccessCheck,
      },
    },
    fields: {
      name: text({ validation: { isRequired: true } }),
      tasks: relationship({ ref: 'Task.assignedTo', many: true }),
    },
  }),
  SecretPlan: list({
    access: {
      operation: {
        query: genericAccessCheck,
        create: genericAccessCheck,
        delete: genericAccessCheck,
      },
    },
    fields: {
      label: text(),
      description: text(),
    },
    ui: {
      isHidden: true,
    },
  }),
};
