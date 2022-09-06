import { config } from '@keystone-6/core';
import { Context } from '.keystone/types';

import { lists } from './schema';
import { insertSeedData } from './seed-data';

export default config({
  db: {
    provider: 'sqlite',
    url: process.env.DATABASE_URL || 'file:./keystone-example.db',
    async onConnect(context: Context) {
      if (process.argv.includes('--seed-data')) {
        await insertSeedData(context);
      }
    },
  },
  lists,
});
