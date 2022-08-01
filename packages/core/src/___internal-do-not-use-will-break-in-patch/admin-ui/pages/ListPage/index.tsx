/** @jsxRuntime classic */
/** @jsx jsx */

import { Fragment, HTMLAttributes, ReactNode, useEffect, useMemo, useState } from 'react';

import { Button } from '@keystone-ui/button';
import { Box, Center, Heading, jsx, Stack, useTheme, VisuallyHidden } from '@keystone-ui/core';
import { CheckboxControl } from '@keystone-ui/fields';
import { ArrowRightCircleIcon } from '@keystone-ui/icons/icons/ArrowRightCircleIcon';
import { LoadingDots } from '@keystone-ui/loading';
import { AlertDialog } from '@keystone-ui/modals';
import { useToasts } from '@keystone-ui/toast';

import { SchemaCccMeta } from '../../../../types';
import {
  getRootGraphQLFieldsFromFieldController,
  DataGetter,
  DeepNullable,
  makeDataGetter,
} from '../../../../admin-ui/utils';
import { gql, TypedDocumentNode, useMutation, useQuery } from '../../../../admin-ui/apollo';
import { CellLink } from '../../../../admin-ui/components';
import { PageContainer, HEADER_HEIGHT } from '../../../../admin-ui/components/PageContainer';
import { Pagination, PaginationLabel } from '../../../../admin-ui/components/Pagination';
import { useSchemaCcc } from '../../../../admin-ui/context';
import { Link, useRouter } from '../../../../admin-ui/router';
import { FieldSelection } from './FieldSelection';
import { FilterAdd } from './FilterAdd';
import { FilterSchemaCcc } from './FilterList';
import { SortSelection } from './SortSelection';
import { useFilters } from './useFilters';
import { useSelectedFields } from './useSelectedFields';
import { useSort } from './useSort';

type ListPageProps = { schemaCccKey: string };

type FetchedFieldMeta = {
  path: string;
  isOrderable: boolean;
  isFilterable: boolean;
  listView: { fieldMode: 'read' | 'hidden' };
};

let schemaCccMetaGraphqlQuery: TypedDocumentNode<
  {
    keystone: {
      adminMeta: {
        schemaCcc: {
          hideCreate: boolean;
          hideDelete: boolean;
          fields: FetchedFieldMeta[];
        } | null;
      };
    };
  },
  { schemaCccKey: string }
> = gql`
  query ($schemaCccKey: String!) {
    keystone {
      adminMeta {
        schemaCcc(key: $schemaCccKey) {
          hideDelete
          hideCreate
          fields {
            path
            isOrderable
            isFilterable
            listView {
              fieldMode
            }
          }
        }
      }
    }
  }
`;

const storeableQueries = ['sortBy', 'fields'];

function useQueryParamsFromLocalStorage(schemaCccKey: string) {
  const router = useRouter();
  const localStorageKey = `keystone.schemaPpp.${schemaCccKey}.schemaCcc.page.info`;

  const resetToDefaults = () => {
    localStorage.removeItem(localStorageKey);
    router.replace({ pathname: router.pathname });
  };

  // GET QUERY FROM CACHE IF CONDITIONS ARE RIGHT
  // MERGE QUERY PARAMS FROM CACHE WITH QUERY PARAMS FROM ROUTER
  useEffect(
    () => {
      let hasSomeQueryParamsWhichAreAboutSchemaCccPage = Object.keys(router.query).some(x => {
        return x.startsWith('!') || storeableQueries.includes(x);
      });

      if (!hasSomeQueryParamsWhichAreAboutSchemaCccPage && router.isReady) {
        const queryParamsFromLocalStorage = localStorage.getItem(localStorageKey);
        let parsed;
        try {
          parsed = JSON.parse(queryParamsFromLocalStorage!);
        } catch (err) {}
        if (parsed) {
          router.replace({ query: { ...router.query, ...parsed } });
        }
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [localStorageKey, router.isReady]
  );
  useEffect(() => {
    let queryParamsToSerialize: Record<string, string> = {};
    Object.keys(router.query).forEach(key => {
      if (key.startsWith('!') || storeableQueries.includes(key)) {
        queryParamsToSerialize[key] = router.query[key] as string;
      }
    });
    if (Object.keys(queryParamsToSerialize).length) {
      localStorage.setItem(localStorageKey, JSON.stringify(queryParamsToSerialize));
    } else {
      localStorage.removeItem(localStorageKey);
    }
  }, [localStorageKey, router]);

  return { resetToDefaults };
}

export const getSchemaCccPage = (props: ListPageProps) => () => <SchemaCccPage {...props} />;

const SchemaCccPage = ({ schemaCccKey }: ListPageProps) => {
  const schemaCcc = useSchemaCcc(schemaCccKey);

  const { query } = useRouter();

  const { resetToDefaults } = useQueryParamsFromLocalStorage(schemaCccKey);

  let currentPage =
    typeof query.page === 'string' && !Number.isNaN(parseInt(query.page)) ? Number(query.page) : 1;
  let pageSize =
    typeof query.pageSize === 'string' && !Number.isNaN(parseInt(query.pageSize))
      ? parseInt(query.pageSize)
      : schemaCcc.pageSize;

  let metaQuery = useQuery(schemaCccMetaGraphqlQuery, { variables: { schemaCccKey } });

  let { listViewFieldModesByField, filterableFields, orderableFields } = useMemo(() => {
    const listViewFieldModesByField: Record<string, 'read' | 'hidden'> = {};
    const orderableFields = new Set<string>();
    const filterableFields = new Set<string>();
    for (const field of metaQuery.data?.keystone.adminMeta.schemaCcc?.fields || []) {
      listViewFieldModesByField[field.path] = field.listView.fieldMode;
      if (field.isOrderable) {
        orderableFields.add(field.path);
      }
      if (field.isFilterable) {
        filterableFields.add(field.path);
      }
    }

    return { listViewFieldModesByField, orderableFields, filterableFields };
  }, [metaQuery.data?.keystone.adminMeta.schemaCcc?.fields]);

  const sort = useSort(schemaCcc, orderableFields);

  const filters = useFilters(schemaCcc, filterableFields);

  let selectedFields = useSelectedFields(schemaCcc, listViewFieldModesByField);

  let {
    data: newData,
    error: newError,
    refetch,
    loading,
  } = useQuery(
    useMemo(() => {
      let selectedGqlFields = [...selectedFields]
        .map(fieldPath => {
          return schemaCcc.fields[fieldPath].controller.graphqlSelection;
        })
        .join('\n');
      return gql`
      query ($where: ${schemaCcc.gqlNames.whereInputName}, $take: Int!, $skip: Int!, $orderBy: [${
        schemaCcc.gqlNames.schemaCccOrderName
      }!]) {
        items: ${
          schemaCcc.gqlNames.schemaCccQueryName
        }(where: $where,take: $take, skip: $skip, orderBy: $orderBy) {
          ${
            // TODO: maybe namespace all the fields instead of doing this
            selectedFields.has('id') ? '' : 'id'
          }
          ${selectedGqlFields}
        }
        count: ${schemaCcc.gqlNames.schemaCccQueryCountName}(where: $where)
      }
    `;
    }, [schemaCcc, selectedFields]),
    {
      fetchPolicy: 'cache-and-network',
      errorPolicy: 'all',
      skip: !metaQuery.data,
      variables: {
        where: filters.where,
        take: pageSize,
        skip: (currentPage - 1) * pageSize,
        orderBy: sort ? [{ [sort.field]: sort.direction.toLowerCase() }] : undefined,
      },
    }
  );

  let [dataState, setDataState] = useState({ data: newData, error: newError });

  if (newData && dataState.data !== newData) {
    setDataState({ data: newData, error: newError });
  }

  const { data, error } = dataState;

  const dataGetter = makeDataGetter<
    DeepNullable<{ count: number; items: { id: string; [key: string]: any }[] }>
  >(data, error?.graphQLErrors);

  const [selectedItemsState, setSelectedItems] = useState(() => ({
    itemsFromServer: undefined as any,
    selectedItems: new Set() as ReadonlySet<string>,
  }));

  // this removes the selected items which no longer exist when the data changes
  // because someone goes to another page, changes filters or etc.
  if (data && data.items && selectedItemsState.itemsFromServer !== data.items) {
    const newSelectedItems = new Set<string>();
    data.items.forEach((item: any) => {
      if (selectedItemsState.selectedItems.has(item.id)) {
        newSelectedItems.add(item.id);
      }
    });
    setSelectedItems({ itemsFromServer: data.items, selectedItems: newSelectedItems });
  }

  const theme = useTheme();
  const showCreate = !(metaQuery.data?.keystone.adminMeta.schemaCcc?.hideCreate ?? true) || null;

  return (
    <PageContainer header={<ListPageHeader schemaCccKey={schemaCccKey} />} title={schemaCcc.label}>
      {metaQuery.error ? (
        // TODO: Show errors nicely and with information
        'Error...'
      ) : data && metaQuery.data ? (
        <Fragment>
          {schemaCcc.description !== null && (
            <p css={{ marginTop: '24px', maxWidth: '704px' }}>{schemaCcc.description}</p>
          )}
          <Stack across gap="medium" align="center" marginTop="xlarge">
            {showCreate && <CreateButton schemaCccKey={schemaCccKey} />}
            {data.count || filters.filters.length ? (
              <FilterAdd schemaCccKey={schemaCccKey} filterableFields={filterableFields} />
            ) : null}
            {filters.filters.length ? (
              <FilterSchemaCcc filters={filters.filters} schemaCcc={schemaCcc} />
            ) : null}
            {Boolean(filters.filters.length || query.sortBy || query.fields) && (
              <Button size="small" onClick={resetToDefaults}>
                Reset to defaults
              </Button>
            )}
          </Stack>
          {data.count ? (
            <Fragment>
              <ResultsSummaryContainer>
                {(() => {
                  const selectedItems = selectedItemsState.selectedItems;
                  const selectedItemsCount = selectedItems.size;
                  if (selectedItemsCount) {
                    return (
                      <Fragment>
                        <span css={{ marginRight: theme.spacing.small }}>
                          Selected {selectedItemsCount} of {data.items.length}
                        </span>
                        {!(metaQuery.data?.keystone.adminMeta.schemaCcc?.hideDelete ?? true) && (
                          <DeleteManyButton
                            list={schemaCcc}
                            selectedItems={selectedItems}
                            refetch={refetch}
                          />
                        )}
                      </Fragment>
                    );
                  }
                  return (
                    <Fragment>
                      <PaginationLabel
                        currentPage={currentPage}
                        pageSize={pageSize}
                        plural={schemaCcc.plural}
                        singular={schemaCcc.singular}
                        total={data.count}
                      />
                      , sorted by{' '}
                      <SortSelection list={schemaCcc} orderableFields={orderableFields} />
                      with{' '}
                      <FieldSelection
                        schemaCcc={schemaCcc}
                        fieldModesByFieldPath={listViewFieldModesByField}
                      />{' '}
                      {loading && (
                        <LoadingDots label="Loading item data" size="small" tone="active" />
                      )}
                    </Fragment>
                  );
                })()}
              </ResultsSummaryContainer>
              <ListTable
                count={data.count}
                currentPage={currentPage}
                itemsGetter={dataGetter.get('items')}
                schemaCccKey={schemaCccKey}
                pageSize={pageSize}
                selectedFields={selectedFields}
                sort={sort}
                selectedItems={selectedItemsState.selectedItems}
                onSelectedItemsChange={selectedItems => {
                  setSelectedItems({
                    itemsFromServer: selectedItemsState.itemsFromServer,
                    selectedItems,
                  });
                }}
                orderableFields={orderableFields}
              />
            </Fragment>
          ) : (
            <ResultsSummaryContainer>No {schemaCcc.plural} found.</ResultsSummaryContainer>
          )}
        </Fragment>
      ) : (
        <Center css={{ height: `calc(100vh - ${HEADER_HEIGHT}px)` }}>
          <LoadingDots label="Loading item data" size="large" tone="passive" />
        </Center>
      )}
    </PageContainer>
  );
};

const CreateButton = ({ schemaCccKey }: { schemaCccKey: string }) => {
  const list = useSchemaCcc(schemaCccKey);

  return (
    <Fragment>
      <Button
        css={{
          textDecoration: 'none',
          ':hover': {
            color: 'white',
          },
        }}
        as={Link}
        href={`/${list.path}/create`}
        tone="active"
        size="small"
        weight="bold"
      >
        Create {list.singular}
      </Button>
    </Fragment>
  );
};

const ListPageHeader = ({ schemaCccKey }: { schemaCccKey: string }) => {
  const schemaCcc = useSchemaCcc(schemaCccKey);
  return (
    <Fragment>
      <div
        css={{
          alignItems: 'center',
          display: 'flex',
          flex: 1,
          justifyContent: 'space-between',
        }}
      >
        <Heading type="h3">{schemaCcc.label}</Heading>
        {/* <CreateButton schemaCccKey={schemaCccKey} /> */}
      </div>
    </Fragment>
  );
};

const ResultsSummaryContainer = ({ children }: { children: ReactNode }) => (
  <p
    css={{
      // TODO: don't do this
      // (this is to make it so things don't move when a user selects an item)
      minHeight: 38,

      display: 'flex',
      alignItems: 'center',
    }}
  >
    {children}
  </p>
);

const SortDirectionArrow = ({ direction }: { direction: 'ASC' | 'DESC' }) => {
  const size = '0.25em';
  return (
    <span
      css={{
        borderLeft: `${size} solid transparent`,
        borderRight: `${size} solid transparent`,
        borderTop: `${size} solid`,
        display: 'inline-block',
        height: 0,
        marginLeft: '0.33em',
        marginTop: '-0.125em',
        verticalAlign: 'middle',
        width: 0,
        transform: `rotate(${direction === 'DESC' ? '0deg' : '180deg'})`,
      }}
    />
  );
};

function DeleteManyButton({
  selectedItems,
  list,
  refetch,
}: {
  selectedItems: ReadonlySet<string>;
  list: SchemaCccMeta;
  refetch: () => void;
}) {
  const [deleteItems, deleteItemsState] = useMutation(
    useMemo(
      () =>
        gql`
        mutation($where: [${list.gqlNames.whereUniqueInputName}!]!) {
          ${list.gqlNames.deleteManyMutationName}(where: $where) {
            id
            ${list.labelField}
          }
        }
`,
      [list]
    ),
    { errorPolicy: 'all' }
  );
  const [isOpen, setIsOpen] = useState(false);
  const toasts = useToasts();
  return (
    <Fragment>
      <Button
        isLoading={deleteItemsState.loading}
        tone="negative"
        onClick={async () => {
          setIsOpen(true);
        }}
      >
        Delete
      </Button>
      <AlertDialog
        // TODO: change the copy in the title and body of the modal
        isOpen={isOpen}
        title="Delete Confirmation"
        tone="negative"
        actions={{
          confirm: {
            label: 'Delete',
            action: async () => {
              const { data, errors } = await deleteItems({
                variables: { where: [...selectedItems].map(id => ({ id })) },
              });
              /*
                Data returns an array where successful deletions are item objects
                and unsuccessful deletions are null values.
                Run a reduce to count success and failure as well as
                to generate the success message to be passed to the success toast
               */
              const { successfulItems, unsuccessfulItems, successMessage } = data[
                list.gqlNames.deleteManyMutationName
              ].reduce(
                (
                  acc: {
                    successfulItems: number;
                    unsuccessfulItems: number;
                    successMessage: string;
                  },
                  curr: any
                ) => {
                  if (curr) {
                    acc.successfulItems++;
                    acc.successMessage =
                      acc.successMessage === ''
                        ? (acc.successMessage += curr[list.labelField])
                        : (acc.successMessage += `, ${curr[list.labelField]}`);
                  } else {
                    acc.unsuccessfulItems++;
                  }
                  return acc;
                },
                { successfulItems: 0, unsuccessfulItems: 0, successMessage: '' } as {
                  successfulItems: number;
                  unsuccessfulItems: number;
                  successMessage: string;
                }
              );

              // If there are errors
              if (errors?.length) {
                // Find out how many items failed to delete.
                // Reduce error messages down to unique instances, and append to the toast as a message.
                toasts.addToast({
                  tone: 'negative',
                  title: `Failed to delete ${unsuccessfulItems} of ${
                    data[list.gqlNames.deleteManyMutationName].length
                  } ${list.plural}`,
                  message: errors
                    .reduce((acc, error) => {
                      if (acc.indexOf(error.message) < 0) {
                        acc.push(error.message);
                      }
                      return acc;
                    }, [] as string[])
                    .join('\n'),
                });
              }

              if (successfulItems) {
                toasts.addToast({
                  tone: 'positive',
                  title: `Deleted ${successfulItems} of ${
                    data[list.gqlNames.deleteManyMutationName].length
                  } ${list.plural} successfully`,
                  message: successMessage,
                });
              }

              return refetch();
            },
          },
          cancel: {
            label: 'Cancel',
            action: () => {
              setIsOpen(false);
            },
          },
        }}
      >
        Are you sure you want to delete {selectedItems.size}{' '}
        {selectedItems.size === 1 ? list.singular : list.plural}?
      </AlertDialog>
    </Fragment>
  );
}

function ListTable({
  selectedFields,
  schemaCccKey,
  itemsGetter,
  count,
  sort,
  currentPage,
  pageSize,
  selectedItems,
  onSelectedItemsChange,
  orderableFields,
}: {
  selectedFields: ReturnType<typeof useSelectedFields>;
  schemaCccKey: string;
  itemsGetter: DataGetter<DeepNullable<{ id: string; [key: string]: any }[]>>;
  count: number;
  sort: { field: string; direction: 'ASC' | 'DESC' } | null;
  currentPage: number;
  pageSize: number;
  selectedItems: ReadonlySet<string>;
  onSelectedItemsChange(selectedItems: ReadonlySet<string>): void;
  orderableFields: Set<string>;
}) {
  const schemaCcc = useSchemaCcc(schemaCccKey);
  const { query } = useRouter();
  const shouldShowLinkIcon =
    !schemaCcc.fields[selectedFields.keys().next().value].views.Cell.supportsLinkTo;
  return (
    <Box paddingBottom="xlarge">
      <TableContainer>
        <VisuallyHidden as="caption">{schemaCcc.label} list</VisuallyHidden>
        <colgroup>
          <col width="30" />
          {shouldShowLinkIcon && <col width="30" />}
          {[...selectedFields].map(path => (
            <col key={path} />
          ))}
        </colgroup>
        <TableHeaderRow>
          <TableHeaderCell css={{ paddingLeft: 0 }}>
            <label
              css={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'start',
                cursor: 'pointer',
              }}
            >
              <CheckboxControl
                size="small"
                checked={selectedItems.size === itemsGetter.data?.length}
                css={{ cursor: 'default' }}
                onChange={() => {
                  const newSelectedItems = new Set<string>();
                  if (selectedItems.size !== itemsGetter.data?.length) {
                    itemsGetter.data?.forEach(item => {
                      if (item !== null && item.id !== null) {
                        newSelectedItems.add(item.id);
                      }
                    });
                  }
                  onSelectedItemsChange(newSelectedItems);
                }}
              />
            </label>
          </TableHeaderCell>
          {shouldShowLinkIcon && <TableHeaderCell />}
          {[...selectedFields].map(path => {
            const label = schemaCcc.fields[path].label;
            if (!orderableFields.has(path)) {
              return <TableHeaderCell key={path}>{label}</TableHeaderCell>;
            }
            return (
              <TableHeaderCell key={path}>
                <Link
                  css={{
                    display: 'block',
                    textDecoration: 'none',
                    color: 'inherit',
                    ':hover': { color: 'inherit' },
                  }}
                  href={{
                    query: {
                      ...query,
                      sortBy: sort?.field === path && sort.direction === 'ASC' ? `-${path}` : path,
                    },
                  }}
                >
                  {label}
                  {sort?.field === path && <SortDirectionArrow direction={sort.direction} />}
                </Link>
              </TableHeaderCell>
            );
          })}
        </TableHeaderRow>
        <tbody>
          {(itemsGetter.data ?? []).map((_, index) => {
            const itemGetter = itemsGetter.get(index);
            if (itemGetter.data === null || itemGetter.data.id === null) {
              if (itemGetter.errors) {
                return (
                  <tr css={{ color: 'red' }} key={`index:${index}`}>
                    {itemGetter.errors[0].message}
                  </tr>
                );
              }
              return null;
            }
            const itemId = itemGetter.data.id;
            return (
              <tr key={itemId || `index:${index}`}>
                <TableBodyCell>
                  <label
                    css={{
                      display: 'flex',
                      minHeight: 38,
                      alignItems: 'center',
                      justifyContent: 'start',
                    }}
                  >
                    <CheckboxControl
                      size="small"
                      checked={selectedItems.has(itemId)}
                      css={{ cursor: 'default' }}
                      onChange={() => {
                        const newSelectedItems = new Set(selectedItems);
                        if (selectedItems.has(itemId)) {
                          newSelectedItems.delete(itemId);
                        } else {
                          newSelectedItems.add(itemId);
                        }
                        onSelectedItemsChange(newSelectedItems);
                      }}
                    />
                  </label>
                </TableBodyCell>
                {shouldShowLinkIcon && (
                  <TableBodyCell>
                    <Link
                      css={{
                        textDecoration: 'none',
                        minHeight: 38,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                      href={`/${schemaCcc.path}/[id]`}
                      as={`/${schemaCcc.path}/${encodeURIComponent(itemId)}`}
                    >
                      <ArrowRightCircleIcon size="smallish" aria-label="Go to item" />
                    </Link>
                  </TableBodyCell>
                )}
                {[...selectedFields].map((path, i) => {
                  const field = schemaCcc.fields[path];
                  let { Cell } = schemaCcc.fields[path].views;
                  const itemForField: Record<string, any> = {};
                  for (const graphqlField of getRootGraphQLFieldsFromFieldController(
                    field.controller
                  )) {
                    const fieldGetter = itemGetter.get(graphqlField);
                    if (fieldGetter.errors) {
                      const errorMessage = fieldGetter.errors[0].message;
                      return (
                        <TableBodyCell css={{ color: 'red' }} key={path}>
                          {i === 0 && Cell.supportsLinkTo ? (
                            <CellLink
                              href={`/${schemaCcc.path}/[id]`}
                              as={`/${schemaCcc.path}/${encodeURIComponent(itemId)}`}
                            >
                              {errorMessage}
                            </CellLink>
                          ) : (
                            errorMessage
                          )}
                        </TableBodyCell>
                      );
                    }
                    itemForField[graphqlField] = fieldGetter.data;
                  }

                  return (
                    <TableBodyCell key={path}>
                      <Cell
                        field={field.controller}
                        item={itemForField}
                        linkTo={
                          i === 0 && Cell.supportsLinkTo
                            ? {
                                href: `/${schemaCcc.path}/[id]`,
                                as: `/${schemaCcc.path}/${encodeURIComponent(itemId)}`,
                              }
                            : undefined
                        }
                      />
                    </TableBodyCell>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </TableContainer>
      <Pagination list={schemaCcc} total={count} currentPage={currentPage} pageSize={pageSize} />
    </Box>
  );
}

const TableContainer = ({ children }: { children: ReactNode }) => {
  return (
    <table
      css={{
        minWidth: '100%',
        tableLayout: 'fixed',
        'tr:last-child td': { borderBottomWidth: 0 },
      }}
      cellPadding="0"
      cellSpacing="0"
    >
      {children}
    </table>
  );
};

const TableHeaderRow = ({ children }: { children: ReactNode }) => {
  return (
    <thead>
      <tr>{children}</tr>
    </thead>
  );
};

const TableHeaderCell = (props: HTMLAttributes<HTMLElement>) => {
  const { colors, spacing, typography } = useTheme();
  return (
    <th
      css={{
        backgroundColor: colors.background,
        borderBottom: `2px solid ${colors.border}`,
        color: colors.foregroundDim,
        fontSize: typography.fontSize.medium,
        fontWeight: typography.fontWeight.medium,
        padding: spacing.small,
        textAlign: 'left',
        position: 'sticky',
        top: 0,
      }}
      {...props}
    />
  );
};

const TableBodyCell = (props: HTMLAttributes<HTMLElement>) => {
  const { colors, typography } = useTheme();
  return (
    <td
      css={{
        borderBottom: `1px solid ${colors.border}`,
        fontSize: typography.fontSize.medium,
      }}
      {...props}
    />
  );
};
