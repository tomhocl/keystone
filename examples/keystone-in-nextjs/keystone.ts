import * as Path from 'path';
import { config } from '@keystone-6/core';
import { lists } from './src/keystone/schema';
import { withAuth, session } from './src/keystone/auth';
import { seedDemoData } from './src/keystone/seed';
import type { Context } from '.keystone/types';

// Next.js deploys need absolute path to sqlite db file
const dbFilePath = `${process.cwd()}/keystone.db`;
export default withAuth(
  config({
    db: {
      provider: 'sqlite',
      url: `file:${dbFilePath}`,
      onConnect: async (context: Context) => {
        await seedDemoData(context);
      },
    },
    ui: {
      getAdditionalFiles: [
        async () => [
          {
            mode: 'copy',
            inputPath: Path.resolve('./src/keystone/next-config.js'),
            outputPath: 'next.config.js',
          },
        ],
      ],
    },
    lists,
    session,
  })
);
