import { integer } from '../../index';

export const name = 'Integer with autoincrement default';
export const typeFunction = (config: any) =>
  integer({
    isIndexed: true,
    ...config,
    db: { ...config?.db, isNullable: false },
    defaultValue: { kind: 'autoincrement' },
  });
export const exampleValue = () => 35;
export const exampleValue2 = () => 36;
export const supportsUnique = true;
export const fieldName = 'orderNumber';
export const supportsGraphQLIsNonNull = true;
export const supportsDbMap = true;
export const skipRequiredTest = true;
export const skipCreateTest = false;
export const skipUpdateTest = true;

export const unSupportedAdapterList = ['sqlite'];

export const getTestFields = () => ({
  orderNumber: integer({
    db: { isNullable: false },
    defaultValue: { kind: 'autoincrement' },
    isIndexed: true,
  }),
});

export const initItems = () => {
  return [
    { name: 'product1' },
    { name: 'product2' },
    { name: 'product3' },
    { name: 'product4' },
    { name: 'product5' },
    { name: 'product6' },
    { name: 'product7' },
  ];
};

export const storedValues = () => [
  { name: 'product1', orderNumber: 1 },
  { name: 'product2', orderNumber: 2 },
  { name: 'product3', orderNumber: 3 },
  { name: 'product4', orderNumber: 4 },
  { name: 'product5', orderNumber: 5 },
  { name: 'product6', orderNumber: 6 },
  { name: 'product7', orderNumber: 7 },
];
