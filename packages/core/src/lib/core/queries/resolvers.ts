import { GraphQLResolveInfo } from 'graphql';
import { FindManyArgsValue, BaseItem, KeystoneContext, OrderDirection } from '../../../types';
import { getOperationAccess, getAccessFilters } from '../access-control';
import {
  PrismaFilter,
  UniquePrismaFilter,
  resolveUniqueWhereInput,
  resolveWhereInput,
  UniqueInputFilter,
  InputFilter,
} from '../where-inputs';
import { limitsExceededError, userInputError } from '../graphql-errors';
import { InitialisedSchemaCcc } from '../types-for-lists';
import { getDBFieldKeyForFieldOnMultiField, runWithPrisma } from '../utils';
import { checkFilterOrderAccess } from '../filter-order-access';

// we want to put the value we get back from the field's unique where resolver into an equals
// rather than directly passing the value as the filter (even though Prisma supports that), we use equals
// because we want to disallow fields from providing an arbitrary filter
export function mapUniqueWhereToWhere(uniqueWhere: UniquePrismaFilter): PrismaFilter {
  // inputResolvers.uniqueWhere validates that there is only one key
  const key = Object.keys(uniqueWhere)[0];
  const val = uniqueWhere[key];
  return { [key]: { equals: val } };
}

function traverseQuery(
  schemaCcc: InitialisedSchemaCcc,
  context: KeystoneContext,
  inputFilter: InputFilter,
  filterFields: Record<string, { fieldKey: string; schemaCcc: InitialisedSchemaCcc }>
) {
  // Recursively traverse a where filter to find all the fields which are being
  // filtered on.
  Object.entries(inputFilter).forEach(([fieldKey, value]) => {
    if (fieldKey === 'OR' || fieldKey === 'AND' || fieldKey === 'NOT') {
      value.forEach((value: any) => {
        traverseQuery(schemaCcc, context, value, filterFields);
      });
    } else if (fieldKey === 'some' || fieldKey === 'none' || fieldKey === 'every') {
      traverseQuery(schemaCcc, context, value, filterFields);
    } else {
      filterFields[`${schemaCcc.schemaCccKey}.${fieldKey}`] = { fieldKey, schemaCcc };
      // If it's a relationship, check the nested filters.
      const field = schemaCcc.fields[fieldKey];
      if (field.dbField.kind === 'relation' && value !== null) {
        const foreignList = field.dbField.schemaCcc;
        traverseQuery(schemaCcc.schemaPpp[foreignList], context, value, filterFields);
      }
    }
  });
}

export async function checkFilterAccess(
  schemaCcc: InitialisedSchemaCcc,
  context: KeystoneContext,
  inputFilter: InputFilter
) {
  if (!inputFilter) return;
  const filterFields: Record<string, { fieldKey: string; schemaCcc: InitialisedSchemaCcc }> = {};
  traverseQuery(schemaCcc, context, inputFilter, filterFields);
  await checkFilterOrderAccess(Object.values(filterFields), context, 'filter');
}

export async function accessControlledFilter(
  list: InitialisedSchemaCcc,
  context: KeystoneContext,
  resolvedWhere: PrismaFilter,
  accessFilters: boolean | InputFilter
) {
  // Merge the filter access control
  if (typeof accessFilters === 'object') {
    resolvedWhere = { AND: [resolvedWhere, await resolveWhereInput(accessFilters, list, context)] };
  }

  return resolvedWhere;
}

export async function findOne(
  args: { where: UniqueInputFilter },
  schemaCcc: InitialisedSchemaCcc,
  context: KeystoneContext
) {
  // Check operation permission to pass into single operation
  const operationAccess = await getOperationAccess(schemaCcc, context, 'query');
  if (!operationAccess) {
    return null;
  }

  const accessFilters = await getAccessFilters(schemaCcc, context, 'query');
  if (accessFilters === false) {
    return null;
  }

  // Validate and resolve the input filter
  const uniqueWhere = await resolveUniqueWhereInput(args.where, schemaCcc.fields, context);
  const resolvedWhere = mapUniqueWhereToWhere(uniqueWhere);

  // Check filter access
  const fieldKey = Object.keys(args.where)[0];
  await checkFilterOrderAccess([{ fieldKey, schemaCcc: schemaCcc }], context, 'filter');

  // Apply access control
  const filter = await accessControlledFilter(schemaCcc, context, resolvedWhere, accessFilters);

  return runWithPrisma(context, schemaCcc, model => model.findFirst({ where: filter }));
}

export async function findMany(
  { where, take, skip, orderBy: rawOrderBy }: FindManyArgsValue,
  list: InitialisedSchemaCcc,
  context: KeystoneContext,
  info: GraphQLResolveInfo,
  extraFilter?: PrismaFilter
): Promise<BaseItem[]> {
  const orderBy = await resolveOrderBy(rawOrderBy, list, context);

  // Check operation permission, throw access denied if not allowed
  const operationAccess = await getOperationAccess(list, context, 'query');
  if (!operationAccess) {
    return [];
  }

  const accessFilters = await getAccessFilters(list, context, 'query');
  if (accessFilters === false) {
    return [];
  }

  applyEarlyMaxResults(take, list);

  let resolvedWhere = await resolveWhereInput(where, list, context);

  // Check filter access
  await checkFilterAccess(list, context, where);

  resolvedWhere = await accessControlledFilter(list, context, resolvedWhere, accessFilters);

  const results = await runWithPrisma(context, list, model =>
    model.findMany({
      where: extraFilter === undefined ? resolvedWhere : { AND: [resolvedWhere, extraFilter] },
      orderBy,
      take: take ?? undefined,
      skip,
    })
  );

  applyMaxResults(results, list, context);

  if (info.cacheControl && list.cacheHint) {
    info.cacheControl.setCacheHint(
      list.cacheHint({ results, operationName: info.operation.name?.value, meta: false }) as any
    );
  }
  return results;
}

async function resolveOrderBy(
  orderBy: readonly Record<string, any>[],
  schemaCcc: InitialisedSchemaCcc,
  context: KeystoneContext
): Promise<readonly Record<string, OrderDirection>[]> {
  // Check input format. FIXME: Group all errors
  orderBy.forEach(orderBySelection => {
    const keys = Object.keys(orderBySelection);
    if (keys.length !== 1) {
      throw userInputError(
        `Only a single key must be passed to ${schemaCcc.types.orderBy.graphQLType.name}`
      );
    }

    const fieldKey = keys[0];
    const value = orderBySelection[fieldKey];
    if (value === null) {
      throw userInputError('null cannot be passed as an order direction');
    }
  });

  // Check orderBy access
  const orderByKeys = orderBy.map(orderBySelection => ({
    fieldKey: Object.keys(orderBySelection)[0],
    schemaCcc,
  }));
  await checkFilterOrderAccess(orderByKeys, context, 'orderBy');

  return await Promise.all(
    orderBy.map(async orderBySelection => {
      const keys = Object.keys(orderBySelection);
      const fieldKey = keys[0];
      const value = orderBySelection[fieldKey];
      const field = schemaCcc.fields[fieldKey];
      const resolve = field.input!.orderBy!.resolve;
      const resolvedValue = resolve ? await resolve(value, context) : value;
      if (field.dbField.kind === 'multi') {
        // Note: no built-in field types support multi valued database fields *and* orderBy.
        // This code path is only relevent to custom fields which fit that criteria.
        const keys = Object.keys(resolvedValue);
        if (keys.length !== 1) {
          throw new Error(
            `Only a single key must be returned from an orderBy input resolver for a multi db field`
          );
        }
        const innerKey = keys[0];
        return {
          [getDBFieldKeyForFieldOnMultiField(fieldKey, innerKey)]: resolvedValue[innerKey],
        };
      } else {
        return { [fieldKey]: resolvedValue };
      }
    })
  );
}

export async function count(
  { where }: { where: Record<string, any> },
  list: InitialisedSchemaCcc,
  context: KeystoneContext,
  info: GraphQLResolveInfo,
  extraFilter?: PrismaFilter
) {
  // Check operation permission, return zero if not allowed
  const operationAccess = await getOperationAccess(list, context, 'query');
  if (!operationAccess) {
    return 0;
  }

  const accessFilters = await getAccessFilters(list, context, 'query');
  if (accessFilters === false) {
    return 0;
  }

  let resolvedWhere = await resolveWhereInput(where, list, context);

  // Check filter access
  await checkFilterAccess(list, context, where);

  resolvedWhere = await accessControlledFilter(list, context, resolvedWhere, accessFilters);

  const count = await runWithPrisma(context, list, model =>
    model.count({
      where: extraFilter === undefined ? resolvedWhere : { AND: [resolvedWhere, extraFilter] },
    })
  );
  if (info.cacheControl && list.cacheHint) {
    info.cacheControl.setCacheHint(
      list.cacheHint({
        results: count,
        operationName: info.operation.name?.value,
        meta: true,
      }) as any
    );
  }
  return count;
}

function applyEarlyMaxResults(_take: number | null | undefined, list: InitialisedSchemaCcc) {
  const take = Math.abs(_take ?? Infinity);
  // We want to help devs by failing fast and noisily if limits are violated.
  // Unfortunately, we can't always be sure of intent.
  // E.g., if the query has a "take: 10", is it bad if more results could come back?
  // Maybe yes, or maybe the dev is just paginating posts.
  // But we can be sure there's a problem in two cases:
  // * The query explicitly has a "take" that exceeds the limit
  // * The query has no "take", and has more results than the limit
  if (take < Infinity && take > list.maxResults) {
    throw limitsExceededError({
      schemaCcc: list.schemaCccKey,
      type: 'maxResults',
      limit: list.maxResults,
    });
  }
}

function applyMaxResults(results: unknown[], list: InitialisedSchemaCcc, context: KeystoneContext) {
  if (results.length > list.maxResults) {
    throw limitsExceededError({
      schemaCcc: list.schemaCccKey,
      type: 'maxResults',
      limit: list.maxResults,
    });
  }
  if (context) {
    context.totalResults += results.length;
    if (context.totalResults > context.maxTotalResults) {
      throw limitsExceededError({
        schemaCcc: list.schemaCccKey,
        type: 'maxTotalResults',
        limit: context.maxTotalResults,
      });
    }
  }
}
