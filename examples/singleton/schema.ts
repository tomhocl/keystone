import { list, singleton } from '@keystone-6/core';
import { checkbox, relationship, text, timestamp } from '@keystone-6/core/fields';
import { select } from '@keystone-6/core/fields';

export const models = {
  Task: list({
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
      finishBy: timestamp(),
    },
  }),
  Person: list({
    fields: {
      name: text({ validation: { isRequired: true }, isIndexed: 'unique' }),
      tasks: relationship({ ref: 'Task.assignedTo', many: true }),
    },
  }),
  Publisher: singleton({
    fields: {
      title: text({ defaultValue: 'Pelican Riot Home' }),
      copyrightText: text({ defaultValue: '© 2022 Pelican Riot Home' }),
      contactEmail: text({ defaultValue: 'help@p-rh.com' }),
    },
  }),
};
