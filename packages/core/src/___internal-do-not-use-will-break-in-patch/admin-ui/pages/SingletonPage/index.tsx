/** @jsxRuntime classic */
/** @jsx jsx */

import {
  Fragment,
  memo,
  ReactElement,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { Button } from '@keystone-ui/button';
import { Box, Center, Stack, Text, jsx } from '@keystone-ui/core';
import { LoadingDots } from '@keystone-ui/loading';
import { AlertDialog } from '@keystone-ui/modals';
import { Notice } from '@keystone-ui/notice';
import { useToasts } from '@keystone-ui/toast';
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
import { useModel } from '../../../../admin-ui/context';
import { PageContainer, HEADER_HEIGHT } from '../../../../admin-ui/components/PageContainer';
import { GraphQLErrorNotice } from '../../../../admin-ui/components/GraphQLErrorNotice';
import { usePreventNavigation } from '../../../../admin-ui/utils/usePreventNavigation';
import { BaseToolbar, ColumnLayout, ItemPageHeader } from '../ItemPage/common';

type ItemPageProps = {
  modelKey: string;
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
  listKey,
  itemGetter,
  selectedFields,
  fieldModes,
}: {
  listKey: string;
  itemGetter: DataGetter<ItemData>;
  selectedFields: string;
  fieldModes: Record<string, 'edit' | 'read' | 'hidden'>;
  showDelete: boolean;
}) {
  const model = useModel(listKey);

  console.log(model);
  const [update, { loading, error, data }] = useMutation(
    gql`mutation ($data: ${model.gqlNames.updateInputName}!) {
      item: ${model.gqlNames.updateMutationName}(data: $data) {
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
    const value = deserializeValue(model.fields, itemGetter);
    return { value, item: itemGetter };
  });
  if (
    !loading &&
    state.item.data !== itemGetter.data &&
    (itemGetter.errors || []).every(x => x.path?.length !== 1)
  ) {
    const value = deserializeValue(model.fields, itemGetter);
    setValue({ value, item: itemGetter });
  }

  const { changedFields, dataForUpdate } = useChangedFieldsAndDataForUpdate(
    model.fields,
    state.item,
    state.value
  );

  const invalidFields = useInvalidFields(model.fields, state.value);

  const [forceValidation, setForceValidation] = useState(false);
  const toasts = useToasts();
  const onSave = useEventCallback(() => {
    const newForceValidation = invalidFields.size !== 0;
    setForceValidation(newForceValidation);
    if (newForceValidation) return;

    update({
      variables: { data: dataForUpdate, id: model.kind === 'list' && state.item.get('id').data },
    })
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
            // title: data.item[list.labelField] || data.item.id,
            tone: 'positive',
            title: 'Saved successfully',
            // message: 'Saved successfully',
          });
        }
      })
      .catch(err => {
        toasts.addToast({ title: 'Failed to update item', tone: 'negative', message: err.message });
      });
  });
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
        fields={model.fields}
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
            value: deserializeValue(model.fields, state.item),
          }));
        })}
        loading={loading}
      />
    </Box>
  );
}

export const getSingletonPage = (props: ItemPageProps) => () => <ItemPage {...props} />;

const ItemPage = ({ modelKey }: ItemPageProps) => {
  const list = useModel(modelKey);
  const { query, selectedFields } = useMemo(() => {
    let selectedFields = Object.entries(list.fields)
      .filter(
        ([fieldKey, field]) =>
          field.itemView.fieldMode !== 'hidden' ||
          // the id field is hidden but we still need to fetch it
          fieldKey === 'id'
      )
      .map(([fieldKey]) => {
        return list.fields[fieldKey].controller.graphqlSelection;
      })
      .join('\n');
    return {
      selectedFields,
      query: gql`
        query ItemPage($modelKey: String!) {
          item: ${list.gqlNames.itemQueryName} {
            ${selectedFields}
          }
          keystone {
            adminMeta {
              model(key: $modelKey) {
                fields {
                  path
                  itemView(id: 1) {
                    fieldMode
                  }
                }
              }
            }
          }
        }
      `,
    };
  }, [list]);

  let { data, error, loading } = useQuery(query, {
    variables: { modelKey },
    errorPolicy: 'all',
  });

  const dataGetter = makeDataGetter<
    DeepNullable<{
      item: ItemData;
      keystone: {
        adminMeta: {
          list: { fields: { path: string; itemView: { fieldMode: 'edit' | 'read' | 'hidden' } }[] };
        };
      };
    }>
  >(data, error?.graphQLErrors);

  let itemViewFieldModesByField = useMemo(() => {
    let itemViewFieldModesByField: Record<string, 'edit' | 'read' | 'hidden'> = {};
    dataGetter.data?.keystone?.adminMeta?.list?.fields?.forEach(field => {
      if (field !== null && field.path !== null && field?.itemView?.fieldMode != null) {
        itemViewFieldModesByField[field.path] = field.itemView.fieldMode;
      }
    });
    return itemViewFieldModesByField;
  }, [dataGetter.data?.keystone?.adminMeta?.list?.fields]);

  const metaQueryErrors = dataGetter.get('keystone').errors;

  // TODO page title on singletons
  const pageTitle: string = loading ? undefined : data && data.item && data.item.id;

  return (
    <PageContainer
      title={pageTitle}
      header={
        <ItemPageHeader
          model={list}
          label={loading ? 'Loading...' : data && data.item && data.item.id}
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
                  The {list.label} could not be found or you don't have access to it.
                </Notice>
              )}
            </Box>
          ) : (
            <Fragment>
              <ItemForm
                fieldModes={itemViewFieldModesByField}
                selectedFields={selectedFields}
                showDelete={false}
                listKey={modelKey}
                itemGetter={dataGetter.get('item') as DataGetter<ItemData>}
              />
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
