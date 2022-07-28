/** @jsxRuntime classic */
/** @jsx jsx */

import copyToClipboard from 'clipboard-copy';
import { useRouter } from 'next/router';
import {
  Fragment,
  HTMLAttributes,
  memo,
  ReactElement,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { Button } from '@keystone-ui/button';
import { Box, Center, Stack, Text, jsx, useTheme } from '@keystone-ui/core';
import { LoadingDots } from '@keystone-ui/loading';
import { ClipboardIcon } from '@keystone-ui/icons/icons/ClipboardIcon';
import { AlertDialog } from '@keystone-ui/modals';
import { Notice } from '@keystone-ui/notice';
import { useToasts } from '@keystone-ui/toast';
import { Tooltip } from '@keystone-ui/tooltip';
import { FieldLabel, TextInput } from '@keystone-ui/fields';
import { SchemaCccMeta } from '../../../../types';
import {
  DataGetter,
  DeepNullable,
  makeDataGetter,
  deserializeValue,
  ItemData,
  useInvalidFields,
  Fields,
  useChangedFieldsAndDataForUpdate,
} from '../../../../admin-ui/utils';

import { gql, useMutation, useQuery } from '../../../../admin-ui/apollo';
import { useSchemaCcc } from '../../../../admin-ui/context';
import { PageContainer, HEADER_HEIGHT } from '../../../../admin-ui/components/PageContainer';
import { GraphQLErrorNotice } from '../../../../admin-ui/components/GraphQLErrorNotice';
import { usePreventNavigation } from '../../../../admin-ui/utils/usePreventNavigation';
import { BaseToolbar, ColumnLayout, ItemPageHeader } from './common';

type ItemPageProps = {
  schemaCccKey: string;
};

function useEventCallback<Func extends (...args: any) => any>(callback: Func): Func {
  const callbackRef = useRef(callback);
  const cb = useCallback((...args: any[]) => {
    return callbackRef.current(...args);
  }, []);
  useEffect(() => {
    callbackRef.current = callback;
  });
  return cb as any;
}

function ItemForm({
  schemaCccKey,
  itemGetter,
  selectedFields,
  fieldModes,
  showDelete,
}: {
  schemaCccKey: string;
  itemGetter: DataGetter<ItemData>;
  selectedFields: string;
  fieldModes: Record<string, 'edit' | 'read' | 'hidden'>;
  showDelete: boolean;
}) {
  const schemaCcc = useSchemaCcc(schemaCccKey);

  const [update, { loading, error, data }] = useMutation(
    gql`mutation ($data: ${schemaCcc.gqlNames.updateInputName}!, $id: ID!) {
      item: ${schemaCcc.gqlNames.updateMutationName}(where: { id: $id }, data: $data) {
        ${selectedFields}
      }
    }`,
    { errorPolicy: 'all' }
  );
  itemGetter =
    useMemo(() => {
      if (data) {
        return makeDataGetter(data, error?.graphQLErrors).get('item');
      }
    }, [data, error]) ?? itemGetter;

  const [state, setValue] = useState(() => {
    const value = deserializeValue(schemaCcc.fields, itemGetter);
    return { value, item: itemGetter };
  });
  if (
    !loading &&
    state.item.data !== itemGetter.data &&
    (itemGetter.errors || []).every(x => x.path?.length !== 1)
  ) {
    const value = deserializeValue(schemaCcc.fields, itemGetter);
    setValue({ value, item: itemGetter });
  }

  const { changedFields, dataForUpdate } = useChangedFieldsAndDataForUpdate(
    schemaCcc.fields,
    state.item,
    state.value
  );

  const invalidFields = useInvalidFields(schemaCcc.fields, state.value);

  const [forceValidation, setForceValidation] = useState(false);
  const toasts = useToasts();
  const onSave = useEventCallback(() => {
    const newForceValidation = invalidFields.size !== 0;
    setForceValidation(newForceValidation);
    if (newForceValidation) return;

    update({ variables: { data: dataForUpdate, id: state.item.get('id').data } })
      // TODO -- Experimenting with less detail in the toasts, so the data lines are commented
      // out below. If we're happy with this, clean up the unused lines.
      .then(({ /* data, */ errors }) => {
        // we're checking for path.length === 1 because errors with a path larger than 1 will
        // be field level errors which are handled seperately and do not indicate a failure to
        // update the item
        const error = errors?.find(x => x.path?.length === 1);
        if (error) {
          toasts.addToast({
            title: 'Failed to update item',
            tone: 'negative',
            message: error.message,
          });
        } else {
          toasts.addToast({
            tone: 'positive',
            title: 'Saved successfully',
          });
        }
      })
      .catch(err => {
        toasts.addToast({ title: 'Failed to update item', tone: 'negative', message: err.message });
      });
  });
  const labelFieldValue = state.item.data?.[schemaCcc.labelField];
  const itemId = state.item.data?.id!;
  const hasChangedFields = !!changedFields.size;
  usePreventNavigation(useMemo(() => ({ current: hasChangedFields }), [hasChangedFields]));
  return (
    <Box marginTop="xlarge">
      <GraphQLErrorNotice
        networkError={error?.networkError}
        // we're checking for path.length === 1 because errors with a path larger than 1 will be field level errors
        // which are handled seperately and do not indicate a failure to update the item
        errors={error?.graphQLErrors.filter(x => x.path?.length === 1)}
      />
      <Fields
        fieldModes={fieldModes}
        fields={schemaCcc.fields}
        forceValidation={forceValidation}
        invalidFields={invalidFields}
        onChange={useCallback(
          value => {
            setValue(state => ({ item: state.item, value: value(state.value) }));
          },
          [setValue]
        )}
        value={state.value}
      />
      <Toolbar
        onSave={onSave}
        hasChangedFields={!!changedFields.size}
        onReset={useEventCallback(() => {
          setValue(state => ({
            item: state.item,
            value: deserializeValue(schemaCcc.fields, state.item),
          }));
        })}
        loading={loading}
        deleteButton={useMemo(
          () =>
            showDelete ? (
              <DeleteButton
                schemaCcc={schemaCcc}
                itemLabel={(labelFieldValue ?? itemId) as string}
                itemId={itemId}
              />
            ) : undefined,
          [showDelete, schemaCcc, labelFieldValue, itemId]
        )}
      />
    </Box>
  );
}

function DeleteButton({
  itemLabel,
  itemId,
  schemaCcc,
}: {
  itemLabel: string;
  itemId: string;
  schemaCcc: SchemaCccMeta;
}) {
  const toasts = useToasts();
  const [deleteItem, { loading }] = useMutation(
    gql`mutation ($id: ID!) {
      ${schemaCcc.gqlNames.deleteMutationName}(where: { id: $id }) {
        id
      }
    }`,
    { variables: { id: itemId } }
  );
  const [isOpen, setIsOpen] = useState(false);
  const router = useRouter();

  return (
    <Fragment>
      <Button
        tone="negative"
        onClick={() => {
          setIsOpen(true);
        }}
      >
        Delete
      </Button>
      <AlertDialog
        // TODO: change the copy in the title and body of the modal
        title="Delete Confirmation"
        isOpen={isOpen}
        tone="negative"
        actions={{
          confirm: {
            label: 'Delete',
            action: async () => {
              try {
                await deleteItem();
              } catch (err: any) {
                return toasts.addToast({
                  title: `Failed to delete ${schemaCcc.singular} item: ${itemLabel}`,
                  message: err.message,
                  tone: 'negative',
                });
              }
              router.push(`/${schemaCcc.path}`);
              return toasts.addToast({
                title: itemLabel,
                message: `Deleted ${schemaCcc.singular} item successfully`,
                tone: 'positive',
              });
            },
            loading,
          },
          cancel: {
            label: 'Cancel',
            action: () => {
              setIsOpen(false);
            },
          },
        }}
      >
        Are you sure you want to delete <strong>{itemLabel}</strong>?
      </AlertDialog>
    </Fragment>
  );
}

export const getItemPage = (props: ItemPageProps) => () => <ItemPage {...props} />;

const ItemPage = ({ schemaCccKey }: ItemPageProps) => {
  const schemaCcc = useSchemaCcc(schemaCccKey);
  const id = useRouter().query.id as string;
  const { spacing, typography } = useTheme();

  const { query, selectedFields } = useMemo(() => {
    let selectedFields = Object.entries(schemaCcc.fields)
      .filter(
        ([fieldKey, field]) =>
          field.itemView.fieldMode !== 'hidden' ||
          // the id field is hidden but we still need to fetch it
          fieldKey === 'id'
      )
      .map(([fieldKey]) => {
        return schemaCcc.fields[fieldKey].controller.graphqlSelection;
      })
      .join('\n');
    return {
      selectedFields,
      query: gql`
        query ItemPage($id: ID!, $schemaCccKey: String!) {
          item: ${schemaCcc.gqlNames.itemQueryName}(where: {id: $id}) {
            ${selectedFields}
          }
          keystone {
            adminMeta {
              schemaCcc(key: $schemaCccKey) {
                hideCreate
                hideDelete
                fields {
                  path
                  itemView(id: $id) {
                    fieldMode
                  }
                }
              }
            }
          }
        }
      `,
    };
  }, [schemaCcc]);
  let { data, error, loading } = useQuery(query, {
    variables: { id, schemaCccKey },
    errorPolicy: 'all',
    skip: id === undefined,
  });
  loading ||= id === undefined;

  const dataGetter = makeDataGetter<
    DeepNullable<{
      item: ItemData;
      keystone: {
        adminMeta: {
          schemaCcc: {
            fields: { path: string; itemView: { fieldMode: 'edit' | 'read' | 'hidden' } }[];
          };
        };
      };
    }>
  >(data, error?.graphQLErrors);

  let itemViewFieldModesByField = useMemo(() => {
    let itemViewFieldModesByField: Record<string, 'edit' | 'read' | 'hidden'> = {};
    dataGetter.data?.keystone?.adminMeta?.schemaCcc?.fields?.forEach(field => {
      if (field !== null && field.path !== null && field?.itemView?.fieldMode != null) {
        itemViewFieldModesByField[field.path] = field.itemView.fieldMode;
      }
    });
    return itemViewFieldModesByField;
  }, [dataGetter.data?.keystone?.adminMeta?.schemaCcc?.fields]);

  const metaQueryErrors = dataGetter.get('keystone').errors;

  const pageTitle: string = loading
    ? undefined
    : (data && data.item && (data.item[schemaCcc.labelField] || data.item.id)) || id;

  return (
    <PageContainer
      title={pageTitle}
      header={
        <ItemPageHeader
          schemaCcc={schemaCcc}
          label={
            loading
              ? 'Loading...'
              : (data && data.item && (data.item[schemaCcc.labelField] || data.item.id)) || id
          }
        />
      }
    >
      {loading ? (
        <Center css={{ height: `calc(100vh - ${HEADER_HEIGHT}px)` }}>
          <LoadingDots label="Loading item data" size="large" tone="passive" />
        </Center>
      ) : metaQueryErrors ? (
        <Box marginY="xlarge">
          <Notice tone="negative">{metaQueryErrors[0].message}</Notice>
        </Box>
      ) : (
        <ColumnLayout>
          {data?.item == null ? (
            <Box marginY="xlarge">
              {error?.graphQLErrors.length || error?.networkError ? (
                <GraphQLErrorNotice
                  errors={error?.graphQLErrors}
                  networkError={error?.networkError}
                />
              ) : (
                <Notice tone="negative">
                  The item with id "{id}" could not be found or you don't have access to it.
                </Notice>
              )}
            </Box>
          ) : (
            <Fragment>
              <ItemForm
                fieldModes={itemViewFieldModesByField}
                selectedFields={selectedFields}
                showDelete={!data.keystone.adminMeta.list!.hideDelete}
                schemaCccKey={schemaCccKey}
                itemGetter={dataGetter.get('item') as DataGetter<ItemData>}
              />
              <StickySidebar>
                <FieldLabel>Item ID</FieldLabel>
                <div
                  css={{
                    display: 'flex',
                    alignItems: 'center',
                  }}
                >
                  <TextInput
                    css={{
                      marginRight: spacing.medium,
                      fontFamily: typography.fontFamily.monospace,
                      fontSize: typography.fontSize.small,
                    }}
                    readOnly
                    value={data.item.id}
                  />
                  <Tooltip content="Copy ID">
                    {props => (
                      <Button
                        {...props}
                        aria-label="Copy ID"
                        onClick={() => {
                          copyToClipboard(data.item.id);
                        }}
                      >
                        <ClipboardIcon size="small" />
                      </Button>
                    )}
                  </Tooltip>
                </div>
              </StickySidebar>
            </Fragment>
          )}
        </ColumnLayout>
      )}
    </PageContainer>
  );
};

// Styled Components
// ------------------------------

const Toolbar = memo(function Toolbar({
  hasChangedFields,
  loading,
  onSave,
  onReset,
  deleteButton,
}: {
  hasChangedFields: boolean;
  loading: boolean;
  onSave: () => void;
  onReset: () => void;
  deleteButton?: ReactElement;
}) {
  return (
    <BaseToolbar>
      <Button
        isDisabled={!hasChangedFields}
        isLoading={loading}
        weight="bold"
        tone="active"
        onClick={onSave}
      >
        Save changes
      </Button>
      <Stack align="center" across gap="small">
        {hasChangedFields ? (
          <ResetChangesButton onReset={onReset} />
        ) : (
          <Text weight="medium" paddingX="large" color="neutral600">
            No changes
          </Text>
        )}
        {deleteButton}
      </Stack>
    </BaseToolbar>
  );
});

function ResetChangesButton(props: { onReset: () => void }) {
  const [isConfirmModalOpen, setConfirmModalOpen] = useState(false);

  return (
    <Fragment>
      <Button
        weight="none"
        onClick={() => {
          setConfirmModalOpen(true);
        }}
      >
        Reset changes
      </Button>
      <AlertDialog
        actions={{
          confirm: {
            action: () => props.onReset(),
            label: 'Reset changes',
          },
          cancel: {
            action: () => setConfirmModalOpen(false),
            label: 'Cancel',
          },
        }}
        isOpen={isConfirmModalOpen}
        title="Are you sure you want to reset changes?"
        tone="negative"
      >
        {null}
      </AlertDialog>
    </Fragment>
  );
}

const StickySidebar = (props: HTMLAttributes<HTMLDivElement>) => {
  const { spacing } = useTheme();
  return (
    <div
      css={{
        marginTop: spacing.xlarge,
        marginBottom: spacing.xxlarge,
        position: 'sticky',
        top: spacing.xlarge,
      }}
      {...props}
    />
  );
};
