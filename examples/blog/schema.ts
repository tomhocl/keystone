import { list } from '@keystone-6/core';
import { allowAll } from '@keystone-6/core/access';
import { select, relationship, text, timestamp } from '@keystone-6/core/fields';
import { cloudinaryImage } from '@keystone-6/cloudinary';

const cloudinary = {
  cloudName: process.env.CLOUDINARY_CLOUD_NAME || 'fake',
  apiKey: process.env.CLOUDINARY_KEY || 'fake',
  apiSecret: process.env.CLOUDINARY_SECRET || 'fake',
  folder: 'testing',
};

export const lists = {
  Post: list({
    access: allowAll,
    ui: {
      searchFields: ['title', 'content'],
    },
    fields: {
      title: text({ validation: { isRequired: true } }),
      status: select({
        type: 'enum',
        options: [
          { label: 'Draft', value: 'draft' },
          { label: 'Published', value: 'published' },
        ],
      }),
      image: cloudinaryImage({
        cloudinary,
        label: 'Source',
      }),
      content: text(),
      publishDate: timestamp(),
      author: relationship({ ref: 'Author.posts', many: false }),
    },
  }),
  Author: list({
    access: allowAll,
    fields: {
      name: text({ validation: { isRequired: true } }),
      email: text({ isIndexed: 'unique', validation: { isRequired: true } }),
      posts: relationship({ ref: 'Post.author', many: true }),
    },
  }),
};
