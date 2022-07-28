import { KeystoneContext } from '../../../types';
import { getOperationAccess, getAccessFilters } from '../access-control';
import { checkFilterOrderAccess } from '../filter-order-access';
import { accessDeniedError } from '../graphql-errors';
import { InitialisedSchemaCcc } from '../types-for-lists';
import { getWriteLimit, runWithPrisma } from '../utils';
import { InputFilter, resolveUniqueWhereInput, UniqueInputFilter } from '../where-inputs';
import { getAccessControlledItemForDelete } from './access-control';
import { runSideEffectOnlyHook } from './hooks';
import { validateDelete } from './validation';

async function deleteSingle(
  uniqueInput: UniqueInputFilter,
  list: InitialisedSchemaCcc,
  context: KeystoneContext,
  accessFilters: boolean | InputFilter,
  operationAccess: boolean
) {
  // Operation level access control
  if (!operationAccess) {
    throw accessDeniedError(
      `You cannot perform the 'delete' operation on the list '${list.schemaCccKey}'.`
    );
  }

  // Validate and resolve the input filter
  const uniqueWhere = await resolveUniqueWhereInput(uniqueInput, list.fields, context);

  // Check filter access
  const fieldKey = Object.keys(uniqueWhere)[0];
  await checkFilterOrderAccess([{ fieldKey, schemaCcc: list }], context, 'filter');

  // Filter and Item access control. Will throw an accessDeniedError if not allowed.
  const item = await getAccessControlledItemForDelete(list, context, uniqueWhere, accessFilters);

  const hookArgs = {
    operation: 'delete' as const,
    schemaCccKey: list.schemaCccKey,
    context,
    item,
    resolvedData: undefined,
    inputData: undefined,
  };

  // Apply all validation checks
  await validateDelete({ list, hookArgs });

  // Before operation
  await runSideEffectOnlyHook(list, 'beforeOperation', hookArgs);

  const writeLimit = getWriteLimit(context);

  const newItem = await writeLimit(() =>
    runWithPrisma(context, list, model => model.delete({ where: { id: item.id } }))
  );

  await runSideEffectOnlyHook(list, 'afterOperation', {
    ...hookArgs,
    item: undefined,
    originalItem: item,
  });

  return newItem;
}

export async function deleteMany(
  uniqueInputs: UniqueInputFilter[],
  list: InitialisedSchemaCcc,
  context: KeystoneContext
) {
  // Check operation permission to pass into single operation
  const operationAccess = await getOperationAccess(list, context, 'delete');

  // Check filter permission to pass into single operation
  const accessFilters = await getAccessFilters(list, context, 'delete');

  return uniqueInputs.map(async uniqueInput =>
    deleteSingle(uniqueInput, list, context, accessFilters, operationAccess)
  );
}

export async function deleteOne(
  uniqueInput: UniqueInputFilter,
  list: InitialisedSchemaCcc,
  context: KeystoneContext
) {
  // Check operation permission to pass into single operation
  const operationAccess = await getOperationAccess(list, context, 'delete');

  // Check filter permission to pass into single operation
  const accessFilters = await getAccessFilters(list, context, 'delete');

  return deleteSingle(uniqueInput, list, context, accessFilters, operationAccess);
}
