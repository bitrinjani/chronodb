import { ChronoDB, TimeSeries } from '../lib/index';

let chrono: ChronoDB;
beforeAll(() => {
  chrono = new ChronoDB(`${__dirname}/database`);
});

afterAll(async () => {
  await chrono.close();
});

describe('simple string db', () => {
  let timeSeries: TimeSeries<string>;

  beforeAll(() => {
    timeSeries = chrono.getTimeSeries<string>('TestSeries');
  });

  afterEach(async () => {
    await timeSeries.delAll();
  });

  test('put and getAll', async () => {
    await timeSeries.put('test1');
    await timeSeries.put('test2');
    const result = await timeSeries.getAll();
    expect(result.length).toBe(2);
    expect(result[0].value).toBe('test1');
    expect(result[1].value).toBe('test2');
  });

  test('put and get', async () => {
    const key1 = await timeSeries.put('test1');
    const key2 = await timeSeries.put('test2');
    const result1 = await timeSeries.get(key1);
    const result2 = await timeSeries.get(key2);
    expect(result1).toBe('test1');
    expect(result2).toBe('test2');
  });

  test('getUnderlyingStore', () => {
    const underlying = chrono.getUnderlyingStore();
    expect(underlying).not.toBeUndefined();
  });
});

describe('object db', () => {
  class Obj {
    field1: string;
    field2: number;
  }

  let timeSeries: TimeSeries<Obj>;

  beforeAll(() => {
    timeSeries = chrono.getTimeSeries<Obj>('TestSeries');
  });

  afterEach(async () => {
    await timeSeries.delAll();
  });

  test('put and getAll', async () => {
    await timeSeries.put({ field1: 's1', field2: 1 });
    await timeSeries.put({ field1: 's2', field2: 2 });
    const result = await timeSeries.getAll();
    expect(result.length).toBe(2);
    expect(result[0].value.field1).toBe('s1');
    expect(result[0].value.field2).toBe(1);
  });

  test('put and get', async () => {
    const key1 = await timeSeries.put({ field1: 's1', field2: 1 });
    const result1 = await timeSeries.get(key1);
    expect(result1).toEqual({ field1: 's1', field2: 1 });
  });

  test('query', async () => {
    await timeSeries.put({ field1: 's1', field2: 1 });
    const end = new Date();
    const result = await timeSeries.query({ start: new Date(0), end });
    console.log(end.valueOf());
    console.log(await timeSeries.getAll());
    expect(result[0].value).toEqual({ field1: 's1', field2: 1 });
    expect(result.length).toBe(1);
  });

  test('queryStream', async () => {
    await timeSeries.put({ field1: 's1', field2: 1 });
    const end = new Date();
    const stream = timeSeries.queryStream({ start: new Date(0), end });
    stream.on('data', (data: { key: string; value: Obj }) => expect(data.value).toEqual({ field1: 's1', field2: 1 }));
  });
});

describe('object db restoring method', () => {
  class Obj {
    field1: string;
    field2: number;
    toSummary() {
      return `${this.field1}, ${this.field2}`;
    }
  }

  const reviver = (obj: Obj) => {
    const newObject = Object.create(Obj.prototype);
    return Object.assign(newObject, obj) as Obj;
  };

  let timeSeries: TimeSeries<Obj>;

  beforeAll(() => {
    timeSeries = chrono.getTimeSeries<Obj>('TestSeries', reviver);
  });

  afterEach(async () => {
    await timeSeries.delAll();
  });

  test('put and getAll', async () => {
    const o1 = new Obj();
    o1.field1 = 's1';
    o1.field2 = 1;
    const o2 = new Obj();
    o2.field1 = 's2';
    o2.field2 = 2;
    await timeSeries.put(o1);
    await timeSeries.put(o2);
    const result = await timeSeries.getAll();
    expect(result.length).toBe(2);
    expect(result[0].value.field1).toBe('s1');
    expect(result[0].value.field2).toBe(1);
  });

  test('put and get', async () => {
    const o1 = new Obj();
    o1.field1 = 's1';
    const key1 = await timeSeries.put(o1);
    const result1 = await timeSeries.get(key1);
    expect(result1).toEqual(o1);
    expect(() => result1.toSummary()).not.toThrow();
  });

  test('query', async () => {
    const o1 = new Obj();
    o1.field1 = 's1';
    await timeSeries.put(o1, new Date('2010-01-01'));
    const o2 = new Obj();
    o2.field1 = 's2';
    await timeSeries.put(o2);

    const result = await timeSeries.query({ start: new Date('2010-01-01'), end: new Date('2010-01-02') });
    expect(result.length).toBe(1);
    expect(result[0].value).toEqual(o1);
    expect(() => result[0].value.toSummary()).not.toThrow();

    const result2 = await timeSeries.query({ start: new Date('2010-01-02'), end: new Date() });
    expect(result2.length).toBe(1);
    expect(result2[0].value).toEqual(o2);
    expect(() => result2[0].value.toSummary()).not.toThrow();
  });

  test('query after unordered insertion', async () => {
    const o2 = new Obj();
    o2.field1 = 's2';
    await timeSeries.put(o2);
    const o1 = new Obj();
    o1.field1 = 's1';
    await timeSeries.put(o1, new Date('2010-01-01'));

    const result = await timeSeries.query({ start: new Date('2010-01-01'), end: new Date('2010-01-02') });
    expect(result.length).toBe(1);
    expect(result[0].value).toEqual(o1);
    expect(() => result[0].value.toSummary()).not.toThrow();

    const result2 = await timeSeries.query({ start: new Date('2010-01-02'), end: new Date() });
    expect(result2.length).toBe(1);
    expect(result2[0].value).toEqual(o2);
    expect(() => result2[0].value.toSummary()).not.toThrow();

    const all = await timeSeries.getAll();
    expect(all[0].value).toEqual(o1);
    expect(all[1].value).toEqual(o2);
  });


  test('queryStream', async () => {
    const o1 = new Obj();
    o1.field1 = 's1';
    o1.field2 = 1;
    await timeSeries.put(o1);
    const end = new Date();
    const stream = timeSeries.queryStream({ start: new Date(0), end });
    stream.on('data', (data: { key: string; value: Obj }) => {
      expect(data.value).toEqual({ field1: 's1', field2: 1 });
      expect(() => data.value.toSummary()).not.toThrow();
    });
  });

  test('del', async () => {
    const o1 = new Obj();
    o1.field1 = 's1';
    const key = await timeSeries.put(o1);
    expect((await timeSeries.getAll()).length).toBe(1);
    await timeSeries.del(key);
    expect((await timeSeries.getAll()).length).toBe(0);
  });
});
