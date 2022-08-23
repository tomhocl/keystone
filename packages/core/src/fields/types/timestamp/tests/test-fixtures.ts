import { timestamp } from '..';

export const name = 'Timestamp';
export const typeFunction = timestamp;
export const exampleValue = () => '1990-12-31T12:34:56.789Z';
export const exampleValue2 = () => '2000-01-20T00:08:00.000Z';
export const supportsNullInput = true;
export const supportsUnique = true;
export const supportsDbMap = true;
export const fieldName = 'lastOnline';

export const getTestFields = () => ({ lastOnline: timestamp() });

export const initItems = () => {
  return [
    { name: 'person1', lastOnline: '1979-04-12T00:08:00.000Z' },
    { name: 'person2', lastOnline: '1980-10-01T23:59:59.999Z' },
    { name: 'person3', lastOnline: '1990-12-31T12:34:56.789Z' },
    { name: 'person4', lastOnline: '2000-01-20T00:08:00.000Z' },
    { name: 'person5', lastOnline: '2020-06-10T10:20:30.456Z' },
    { name: 'person6', lastOnline: null },
    { name: 'person7' },
  ];
};

export const storedValues = () => [
  { name: 'person1', lastOnline: '1979-04-12T00:08:00.000Z' },
  { name: 'person2', lastOnline: '1980-10-01T23:59:59.999Z' },
  { name: 'person3', lastOnline: '1990-12-31T12:34:56.789Z' },
  { name: 'person4', lastOnline: '2000-01-20T00:08:00.000Z' },
  { name: 'person5', lastOnline: '2020-06-10T10:20:30.456Z' },
  { name: 'person6', lastOnline: null },
  { name: 'person7', lastOnline: null },
];
