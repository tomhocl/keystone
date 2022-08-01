import { KeystoneContext } from './context';
import { BaseItem } from './next-fields';

type GraphQLInput = Record<string, any>;

export type BaseSchemaCccTypeInfo = {
  key: string;
  fields: string;
  item: BaseItem;
  inputs: {
    create: GraphQLInput;
    update: GraphQLInput;
    where: GraphQLInput;
    uniqueWhere: { readonly id?: string | null } & GraphQLInput;
    orderBy: Record<string, 'asc' | 'desc' | null>;
  };
  all: BaseKeystoneTypeInfo;
};

export type KeystoneContextFromSchemaCccTypeInfo<SchemaCccTypeInfo extends BaseSchemaCccTypeInfo> =
  KeystoneContext<SchemaCccTypeInfo['all']>;

export type BaseKeystoneTypeInfo = {
  schemaPpp: Record<string, BaseSchemaCccTypeInfo>;
  prisma: any;
};
