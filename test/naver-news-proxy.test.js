const axios = require('axios');
const assert = require('assert');

const BASE_URL = 'http://localhost:4000/api/naver-news';

describe('네이버 뉴스 프록시 API', () => {
  it('한글 키워드(테스트) 정상 동작', async () => {
    const res = await axios.get(BASE_URL, { params: { query: '테스트', max: 3 } });
    console.log('한글 키워드 items.length:', res.data.items.length);
    console.log('titles:', res.data.items.map(i => i.title));
    assert(Array.isArray(res.data.items));
    assert(res.data.items.length <= 3);
  });

  it('특수문자 포함 키워드(백종원&지역개발사업) 정상 동작', async () => {
    const res = await axios.get(BASE_URL, { params: { query: '백종원&지역개발사업', max: 2 } });
    console.log('특수문자 키워드 items.length:', res.data.items.length);
    console.log('titles:', res.data.items.map(i => i.title));
    assert(Array.isArray(res.data.items));
    assert(res.data.items.length <= 2);
  });

  it('긴 키워드 정상 동작', async () => {
    const longKeyword = '테스트'.repeat(20);
    const res = await axios.get(BASE_URL, { params: { query: longKeyword, max: 1 } });
    console.log('긴 키워드 items.length:', res.data.items.length);
    console.log('titles:', res.data.items.map(i => i.title));
    assert(Array.isArray(res.data.items));
    assert(res.data.items.length <= 1);
  });

  it('query 파라미터 누락 시 400 에러', async () => {
    try {
      await axios.get(BASE_URL);
      assert.fail('400 에러가 발생해야 합니다.');
    } catch (err) {
      assert.strictEqual(err.response.status, 400);
      assert(err.response.data.error.includes('query'));
    }
  });
}); 