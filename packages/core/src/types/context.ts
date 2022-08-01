import { IncomingMessage } from 'http';
import { Readable } from 'stream';
import { GraphQLSchema, ExecutionResult, DocumentNode } from 'graphql';
import { InitialisedSchemaCcc } from '../lib/core/types-for-lists';
import { BaseSchemaCccTypeInfo } from './type-info';
import { GqlNames, BaseKeystoneTypeInfo } from '.';

export type KeystoneContext<TypeInfo extends BaseKeystoneTypeInfo = BaseKeystoneTypeInfo> = {
  req?: IncomingMessage;
  db: KeystoneDbAPI<TypeInfo['schemaPpp']>;
  query: KeystoneSchemaPppAPI<TypeInfo['schemaPpp']>;
  graphql: KeystoneGraphQLAPI;
  sudo: () => KeystoneContext<TypeInfo>;
  exitSudo: () => KeystoneContext<TypeInfo>;
  withSession: (session: any) => KeystoneContext<TypeInfo>;
  prisma: TypeInfo['prisma'];
  files: FilesContext;
  images: ImagesContext;
  totalResults: number;
  maxTotalResults: number;
  /** @deprecated */
  gqlNames: (schemaCccKey: string) => GqlNames;
  experimental?: {
    /** @deprecated This value is only available if you have config.experimental.initialisedSchemaPpp = true.
     * This is not a stable API and may contain breaking changes in `patch` level releases.
     */
    initialisedSchemaPpp: Record<string, InitialisedSchemaCcc>;
  };
} & Partial<SessionContext<any>>;

// Schema Ccc item API

// TODO: Work out whether we can generate useful return types based on the GraphQL Query
// passed to List API functions (see `readonly Record<string, any>` below)

export type KeystoneSchemaPppAPI<
  KeystoneSchemaCccTypeInfo extends Record<string, BaseSchemaCccTypeInfo>
> = {
  [Key in keyof KeystoneSchemaCccTypeInfo]: {
    findMany(
      args?: {
        readonly where?: KeystoneSchemaCccTypeInfo[Key]['inputs']['where'];
        readonly take?: number;
        readonly skip?: number;
        readonly orderBy?:
          | KeystoneSchemaCccTypeInfo[Key]['inputs']['orderBy']
          | readonly KeystoneSchemaCccTypeInfo[Key]['inputs']['orderBy'][];
      } & ResolveFields
    ): Promise<readonly Record<string, any>[]>;
    findOne(
      args: {
        readonly where: KeystoneSchemaCccTypeInfo[Key]['inputs']['uniqueWhere'];
      } & ResolveFields
    ): Promise<Record<string, any>>;
    count(args?: {
      readonly where?: KeystoneSchemaCccTypeInfo[Key]['inputs']['where'];
    }): Promise<number>;
    updateOne(
      args: {
        readonly where: KeystoneSchemaCccTypeInfo[Key]['inputs']['uniqueWhere'];
        readonly data: KeystoneSchemaCccTypeInfo[Key]['inputs']['update'];
      } & ResolveFields
    ): Promise<Record<string, any>>;
    updateMany(
      args: {
        readonly data: readonly {
          readonly where: KeystoneSchemaCccTypeInfo[Key]['inputs']['uniqueWhere'];
          readonly data: KeystoneSchemaCccTypeInfo[Key]['inputs']['update'];
        }[];
      } & ResolveFields
    ): Promise<Record<string, any>[]>;
    createOne(
      args: { readonly data: KeystoneSchemaCccTypeInfo[Key]['inputs']['create'] } & ResolveFields
    ): Promise<Record<string, any>>;
    createMany(
      args: {
        readonly data: readonly KeystoneSchemaCccTypeInfo[Key]['inputs']['create'][];
      } & ResolveFields
    ): Promise<Record<string, any>[]>;
    deleteOne(
      args: {
        readonly where: KeystoneSchemaCccTypeInfo[Key]['inputs']['uniqueWhere'];
      } & ResolveFields
    ): Promise<Record<string, any> | null>;
    deleteMany(
      args: {
        readonly where: readonly KeystoneSchemaCccTypeInfo[Key]['inputs']['uniqueWhere'][];
      } & ResolveFields
    ): Promise<Record<string, any>[]>;
  };
};

type ResolveFields = {
  /**
   * @default 'id'
   */
  readonly query?: string;
};

export type KeystoneDbAPI<KeystoneSchemaCccTypeInfo extends Record<string, BaseSchemaCccTypeInfo>> =
  {
    [Key in keyof KeystoneSchemaCccTypeInfo]: {
      findMany(args?: {
        readonly where?: KeystoneSchemaCccTypeInfo[Key]['inputs']['where'];
        readonly take?: number;
        readonly skip?: number;
        readonly orderBy?:
          | KeystoneSchemaCccTypeInfo[Key]['inputs']['orderBy']
          | readonly KeystoneSchemaCccTypeInfo[Key]['inputs']['orderBy'][];
      }): Promise<readonly KeystoneSchemaCccTypeInfo[Key]['item'][]>;
      findOne(args: {
        readonly where: KeystoneSchemaCccTypeInfo[Key]['inputs']['uniqueWhere'];
      }): Promise<KeystoneSchemaCccTypeInfo[Key]['item'] | null>;
      count(args?: {
        readonly where?: KeystoneSchemaCccTypeInfo[Key]['inputs']['where'];
      }): Promise<number>;
      updateOne(args: {
        readonly where: KeystoneSchemaCccTypeInfo[Key]['inputs']['uniqueWhere'];
        readonly data: KeystoneSchemaCccTypeInfo[Key]['inputs']['update'];
      }): Promise<KeystoneSchemaCccTypeInfo[Key]['item']>;
      updateMany(args: {
        readonly data: readonly {
          readonly where: KeystoneSchemaCccTypeInfo[Key]['inputs']['uniqueWhere'];
          readonly data: KeystoneSchemaCccTypeInfo[Key]['inputs']['update'];
        }[];
      }): Promise<KeystoneSchemaCccTypeInfo[Key]['item'][]>;
      createOne(args: {
        readonly data: KeystoneSchemaCccTypeInfo[Key]['inputs']['create'];
      }): Promise<KeystoneSchemaCccTypeInfo[Key]['item']>;
      createMany(args: {
        readonly data: readonly KeystoneSchemaCccTypeInfo[Key]['inputs']['create'][];
      }): Promise<KeystoneSchemaCccTypeInfo[Key]['item'][]>;
      deleteOne(args: {
        readonly where: KeystoneSchemaCccTypeInfo[Key]['inputs']['uniqueWhere'];
      }): Promise<KeystoneSchemaCccTypeInfo[Key]['item']>;
      deleteMany(args: {
        readonly where: readonly KeystoneSchemaCccTypeInfo[Key]['inputs']['uniqueWhere'][];
      }): Promise<KeystoneSchemaCccTypeInfo[Key]['item'][]>;
    };
  };

// GraphQL API

export type KeystoneGraphQLAPI = {
  schema: GraphQLSchema;
  run: (args: GraphQLExecutionArguments) => Promise<Record<string, any>>;
  raw: (args: GraphQLExecutionArguments) => Promise<ExecutionResult>;
};

type GraphQLExecutionArguments = {
  query: string | DocumentNode;
  variables?: Record<string, any>;
};

// Session API

export type SessionContext<T> = {
  // Note: session is typed like this to acknowledge the default session shape
  // if you're using keystone's built-in session implementation, but we don't
  // actually know what it will look like.
  session?: { itemId: string; schemaCccKey: string; data?: Record<string, any> } | any;
  startSession(data: T): Promise<string>;
  endSession(): Promise<void>;
};

export type AssetMode = 'local' | 's3';

// Files API

export type FileMetadata = {
  filename: string;
  filesize: number;
};

export type FileData = {
  filename: string;
} & FileMetadata;

export type FilesContext = (storage: string) => {
  getUrl: (filename: string) => Promise<string>;
  getDataFromStream: (stream: Readable, filename: string) => Promise<FileData>;
  deleteAtSource: (filename: string) => Promise<void>;
};

// Images API

export type ImageExtension = 'jpg' | 'png' | 'webp' | 'gif';

export type ImageMetadata = {
  extension: ImageExtension;
  filesize: number;
  width: number;
  height: number;
};

export type ImageData = {
  id: string;
} & ImageMetadata;

export type ImagesContext = (storage: string) => {
  getUrl: (id: string, extension: ImageExtension) => Promise<string>;
  getDataFromStream: (stream: Readable, filename: string) => Promise<ImageData>;
  deleteAtSource: (id: string, extension: ImageExtension) => Promise<void>;
};
