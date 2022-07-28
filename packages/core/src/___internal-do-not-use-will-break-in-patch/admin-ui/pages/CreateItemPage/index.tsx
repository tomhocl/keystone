/** @jsxRuntime classic */
/** @jsx jsx */

import { Box, jsx } from '@keystone-ui/core';
import { LoadingDots } from '@keystone-ui/loading';
import { Button } from '@keystone-ui/button';
import { useRouter } from 'next/router';
import { Fields } from '../../../../admin-ui/utils';
import { PageContainer } from '../../../../admin-ui/components/PageContainer';
import { useKeystone, useSchemaCcc } from '../../../../admin-ui';
import { GraphQLErrorNotice } from '../../../../admin-ui/components';
import { SchemaCccMeta } from '../../../../types';
import { useCreateItem } from '../../../../admin-ui/utils/useCreateItem';
import { BaseToolbar, ColumnLayout, ItemPageHeader } from '../ItemPage/common';

function CreatePageForm(props: { schemaCcc: SchemaCccMeta }) {
  const createItem = useCreateItem(props.schemaCcc);
  const router = useRouter();
  return (
    <Box paddingTop="xlarge">
      {createItem.error && (
        <GraphQLErrorNotice
          networkError={createItem.error?.networkError}
          errors={createItem.error?.graphQLErrors}
        />
      )}

      <form
        onSubmit={async event => {
          event.preventDefault();
          const item = await createItem.create();
          if (item) {
            router.push(`/${props.schemaCcc.path}/${item.id}`);
          }
        }}
      >
        <Fields {...createItem.props} />
        <BaseToolbar>
          <Button
            isLoading={createItem.state === 'loading'}
            type="submit"
            weight="bold"
            tone="active"
          >
            Create {props.schemaCcc.singular}
          </Button>
        </BaseToolbar>
      </form>
    </Box>
  );
}

type CreateItemPageProps = { schemaCccKey: string };

export const getCreateItemPage = (props: CreateItemPageProps) => () =>
  <CreateItemPage {...props} />;

function CreateItemPage(props: CreateItemPageProps) {
  const schemaCcc = useSchemaCcc(props.schemaCccKey);
  const { createViewFieldModes } = useKeystone();

  return (
    <PageContainer
      title={`Create ${schemaCcc.singular}`}
      header={<ItemPageHeader schemaCcc={schemaCcc} label="Create" />}
    >
      <ColumnLayout>
        <Box>
          {createViewFieldModes.state === 'error' && (
            <GraphQLErrorNotice
              networkError={
                createViewFieldModes.error instanceof Error ? createViewFieldModes.error : undefined
              }
              errors={
                createViewFieldModes.error instanceof Error ? undefined : createViewFieldModes.error
              }
            />
          )}
          {createViewFieldModes.state === 'loading' && <LoadingDots label="Loading create form" />}
          <CreatePageForm schemaCcc={schemaCcc} />
        </Box>
      </ColumnLayout>
    </PageContainer>
  );
}
