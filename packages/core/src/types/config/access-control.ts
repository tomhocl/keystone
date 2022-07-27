import type { MaybePromise } from '../utils';
import type { KeystoneContextFromSchemaTypeTypeInfo } from '..';
import { BaseSchemaTypeTypeInfo } from '../type-info';

type BaseAccessArgs<SchemaTypeTypeInfo extends BaseSchemaTypeTypeInfo> = {
  session: any;
  listKey: string;
  context: KeystoneContextFromSchemaTypeTypeInfo<SchemaTypeTypeInfo>;
};

// List Filter Access

type FilterOutput<SchemaTypeTypeInfo extends BaseSchemaTypeTypeInfo> =
  | boolean
  | SchemaTypeTypeInfo['inputs']['where'];

export type ListFilterAccessControl<
  Operation extends 'query' | 'update' | 'delete',
  SchemaTypeTypeInfo extends BaseSchemaTypeTypeInfo
> = (
  args: BaseAccessArgs<SchemaTypeTypeInfo> & { operation: Operation }
) => MaybePromise<FilterOutput<SchemaTypeTypeInfo>>;

// List Item Access

type CreateItemAccessArgs<SchemaTypeTypeInfo extends BaseSchemaTypeTypeInfo> =
  BaseAccessArgs<SchemaTypeTypeInfo> & {
    operation: 'create';
    /**
     * The input passed in from the GraphQL API
     */
    inputData: SchemaTypeTypeInfo['inputs']['create'];
  };

export type CreateListItemAccessControl<SchemaTypeTypeInfo extends BaseSchemaTypeTypeInfo> = (
  args: CreateItemAccessArgs<SchemaTypeTypeInfo>
) => MaybePromise<boolean>;

type UpdateItemAccessArgs<SchemaTypeTypeInfo extends BaseSchemaTypeTypeInfo> =
  BaseAccessArgs<SchemaTypeTypeInfo> & {
    operation: 'update';
    /**
     * The item being updated
     */
    item: SchemaTypeTypeInfo['item'];
    /**
     * The input passed in from the GraphQL API
     */
    inputData: SchemaTypeTypeInfo['inputs']['update'];
  };

export type UpdateListItemAccessControl<SchemaTypeTypeInfo extends BaseSchemaTypeTypeInfo> = (
  args: UpdateItemAccessArgs<SchemaTypeTypeInfo>
) => MaybePromise<boolean>;

type DeleteItemAccessArgs<SchemaTypeTypeInfo extends BaseSchemaTypeTypeInfo> =
  BaseAccessArgs<SchemaTypeTypeInfo> & {
    operation: 'delete';
    /**
     * The item being deleted
     */
    item: SchemaTypeTypeInfo['item'];
  };

export type DeleteListItemAccessControl<SchemaTypeTypeInfo extends BaseSchemaTypeTypeInfo> = (
  args: DeleteItemAccessArgs<SchemaTypeTypeInfo>
) => MaybePromise<boolean>;

export type ListOperationAccessControl<
  Operation extends 'create' | 'query' | 'update' | 'delete',
  SchemaTypeTypeInfo extends BaseSchemaTypeTypeInfo
> = (args: BaseAccessArgs<SchemaTypeTypeInfo> & { operation: Operation }) => MaybePromise<boolean>;

// List level access control lets you set permissions on the autogenerated CRUD API for each list.
//
// * `operation` access lets you check the information in the `context` and `session` objects to decide if the
// user is allow to access the list.
// * `filter` access lets you provide a GraphQL filter which defines the items the user is allowed to access.
// * `item` access lets you write a function which inspects the provided input data and the existing object (if it exists)
// and make a decision based on this extra data.
//
// If access is denied due to any of the access control methods then the following response will be returned from the GraphQL API:
//   Mutations:
//     - Single operations will return `null` and return an access denied error
//     - Multi operations will return a data array with `null` values for the items which have access denied.
//       Access denied errors will be return for each `null` items.
//   Queries:
//     - Single item queries will return `null` with no errors.
//     - Many item queries will filter out those items which have access denied, with no errors.
//     - Count queries will only count those items for which access is not denied, with no errors.
//
export type ListAccessControl<SchemaTypeTypeInfo extends BaseSchemaTypeTypeInfo> = {
  // These functions should return `true` if access is allowed or `false` if access is denied.
  operation?: {
    query?: ListOperationAccessControl<'query', SchemaTypeTypeInfo>;
    create?: ListOperationAccessControl<'create', SchemaTypeTypeInfo>;
    update?: ListOperationAccessControl<'update', SchemaTypeTypeInfo>;
    delete?: ListOperationAccessControl<'delete', SchemaTypeTypeInfo>;
  };

  // The 'filter' rules can return either:
  // - a filter. In this case, the operation can proceed, but the filter will be additionally applied when updating/reading/deleting
  //   which may make it appear that some of the items don't exist.
  // - boolean true/false. If false, treated as a filter that never matches.
  filter?: {
    query?: ListFilterAccessControl<'query', SchemaTypeTypeInfo>;
    update?: ListFilterAccessControl<'update', SchemaTypeTypeInfo>;
    delete?: ListFilterAccessControl<'delete', SchemaTypeTypeInfo>;
    // create: not supported: FIXME: Add explicit check that people don't try this.
    // FIXME: Write tests for parseAccessControl.
  };

  // These rules are applied to each item being operated on individually. They return `true` or `false`,
  // and if false, an access denied error will be returned for the individual operation.
  item?: {
    // query: not supported
    create?: CreateListItemAccessControl<SchemaTypeTypeInfo>;
    update?: UpdateListItemAccessControl<SchemaTypeTypeInfo>;
    delete?: DeleteListItemAccessControl<SchemaTypeTypeInfo>;
  };
};

// Field Access
export type IndividualFieldAccessControl<Args> = (args: Args) => MaybePromise<boolean>;

export type FieldCreateItemAccessArgs<SchemaTypeTypeInfo extends BaseSchemaTypeTypeInfo> =
  CreateItemAccessArgs<SchemaTypeTypeInfo> & { fieldKey: string };

export type FieldReadItemAccessArgs<SchemaTypeTypeInfo extends BaseSchemaTypeTypeInfo> =
  BaseAccessArgs<SchemaTypeTypeInfo> & {
    operation: 'read';
    fieldKey: string;
    item: SchemaTypeTypeInfo['item'];
  };

export type FieldUpdateItemAccessArgs<SchemaTypeTypeInfo extends BaseSchemaTypeTypeInfo> =
  UpdateItemAccessArgs<SchemaTypeTypeInfo> & { fieldKey: string };

export type FieldAccessControl<SchemaTypeTypeInfo extends BaseSchemaTypeTypeInfo> =
  | {
      read?: IndividualFieldAccessControl<FieldReadItemAccessArgs<SchemaTypeTypeInfo>>;
      create?: IndividualFieldAccessControl<FieldCreateItemAccessArgs<SchemaTypeTypeInfo>>;
      update?: IndividualFieldAccessControl<FieldUpdateItemAccessArgs<SchemaTypeTypeInfo>>;
      // filter?: COMING SOON
      // orderBy?: COMING SOON
    }
  | IndividualFieldAccessControl<
      | FieldCreateItemAccessArgs<SchemaTypeTypeInfo>
      | FieldReadItemAccessArgs<SchemaTypeTypeInfo>
      | FieldUpdateItemAccessArgs<SchemaTypeTypeInfo>
    >;
