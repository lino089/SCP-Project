import assert from 'node:assert';
import test from 'node:test';
import { unwrap, unwrapList, unwrapPagination, isSuccess } from '../../frontend/scp_web/src/utils/responseHelper.js';

test('unwrap extracts data from Laravel API response envelope', () => {
  const res = { success: true, data: { id: 1, name: 'Alice' }, message: 'OK' };
  assert.deepStrictEqual(unwrap(res), { id: 1, name: 'Alice' });
});

test('unwrap handles raw axios response if mistakenly passed', () => {
  const axiosRes = {
    status: 200,
    headers: {},
    data: { success: true, data: [1, 2, 3] },
  };
  assert.deepStrictEqual(unwrap(axiosRes), [1, 2, 3]);
});

test('unwrapList correctly unwraps both direct collections and paginated envelopes', () => {
  // Direct array in data
  const directRes = { success: true, data: [{ id: 1 }, { id: 2 }] };
  assert.strictEqual(unwrapList(directRes).length, 2);

  // Paginated Laravel response: data.data
  const paginatedRes = {
    success: true,
    data: {
      data: [{ id: 10 }, { id: 20 }, { id: 30 }],
      current_page: 1,
      per_page: 15,
      total: 30,
    },
  };
  const list = unwrapList(paginatedRes);
  assert.strictEqual(list.length, 3);
  assert.strictEqual(list[0].id, 10);

  // Pagination metadata unwrap
  const pag = unwrapPagination(paginatedRes);
  assert.strictEqual(pag.items.length, 3);
  assert.strictEqual(pag.meta.total, 30);
  assert.strictEqual(pag.meta.current_page, 1);
});

test('isSuccess correctly identifies successful responses', () => {
  assert.strictEqual(isSuccess({ success: true }), true);
  assert.strictEqual(isSuccess({ success: false }), false);
  assert.strictEqual(isSuccess({ status: 200 }), true);
  assert.strictEqual(isSuccess({ status: 500 }), false);
  assert.strictEqual(isSuccess(null), false);
});
