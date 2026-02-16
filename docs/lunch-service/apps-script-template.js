/**
 * Google Apps Script - 점심 추천 서비스 API
 * 
 * 배포 방법:
 * 1. Google Sheets에서 확장 프로그램 > Apps Script 열기
 * 2. 이 코드를 붙여넣기
 * 3. 환경변수 설정 (스크립트 속성):
 *    - API_KEY: server.js와 공유할 x-api-key 값
 *    - PERPLEXITY_API_KEY: (선택) LLM API 키
 * 4. 배포 > 새 배포 > 유형: 웹 앱
 * 5. 실행 대상: 나, 액세스 권한: 모든 사용자
 * 6. 배포 URL을 복사하여 server.js의 GOOGLE_APPS_SCRIPT_URL에 설정
 */

// 환경변수 가져오기
function getApiKey() {
  const props = PropertiesService.getScriptProperties();
  return props.getProperty('API_KEY') || '';
}

function getPerplexityApiKey() {
  const props = PropertiesService.getScriptProperties();
  return props.getProperty('PERPLEXITY_API_KEY') || '';
}

// api_key 검증 (웹 앱은 헤더 미지원 → 쿼리/parameter 사용)
function validateApiKey(request) {
  const apiKey = (request.parameter && request.parameter.api_key) ||
    (request.headers && (request.headers['x-api-key'] || request.headers['X-Api-Key']));
  const expectedKey = getApiKey();
  
  if (!expectedKey || apiKey !== expectedKey) {
    return {
      success: false,
      error: '인증 실패'
    };
  }
  return null;
}

// Google Sheets에서 데이터 가져오기
function getSheetData(sheetName) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(sheetName);
  
  if (!sheet) {
    return [];
  }
  
  const data = sheet.getDataRange().getValues();
  if (data.length < 2) {
    return [];
  }
  
  const headers = data[0];
  const rows = data.slice(1);
  
  return rows.map(row => {
    const obj = {};
    headers.forEach((header, index) => {
      obj[header] = row[index] || '';
    });
    return obj;
  });
}

// Google Sheets에 데이터 추가
function appendSheetData(sheetName, data) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(sheetName);
  
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    // 헤더 추가 (첫 번째 데이터의 키를 헤더로 사용)
    const headers = Object.keys(data);
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  }
  
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const row = headers.map(header => data[header] || '');
  sheet.appendRow(row);
  
  return {
    success: true,
    data: data
  };
}

// ID 생성 (타임스탬프 기반)
function generateId(prefix) {
  return prefix + '_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

// GET /places - 장소 목록 조회
function getPlaces() {
  const places = getSheetData('places');
  return {
    success: true,
    data: places
  };
}

// POST /places - 새 장소 등록
function createPlace(requestData) {
  const placeId = generateId('place');
  const now = new Date().toISOString();
  
  const placeData = {
    place_id: placeId,
    name: requestData.name || '',
    address_text: requestData.address_text || '',
    naver_map_url: requestData.naver_map_url || '',
    category: requestData.category || '',
    price_level: requestData.price_level || '',
    tags: requestData.tags || '',
    walk_min: requestData.walk_min || 0,
    solo_ok: requestData.solo_ok || false,
    group_ok: requestData.group_ok || false,
    indoor_ok: requestData.indoor_ok || false,
    image_url: requestData.image_url || '',
    lat: requestData.lat || '',
    lng: requestData.lng || '',
    created_at: now,
    updated_at: now
  };
  
  appendSheetData('places', placeData);
  
  return {
    success: true,
    data: {
      place_id: placeId,
      created_at: now
    }
  };
}

// PUT /places/:id - 장소 수정
function updatePlace(placeId, requestData) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('places');
  if (!sheet) return { success: false, error: 'places 시트를 찾을 수 없습니다.' };
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const idCol = headers.indexOf('place_id');
  if (idCol === -1) return { success: false, error: 'place_id 컬럼을 찾을 수 없습니다.' };
  
  for (let i = 1; i < data.length; i++) {
    if (data[i][idCol] === placeId) {
      const row = i + 1;
      const now = new Date().toISOString();
      
      // 모든 필드 업데이트
      const fields = ['name', 'address_text', 'category', 'price_level', 'walk_min', 
                      'keywords', 'tags', 'solo_ok', 'group_ok', 'indoor_ok', 
                      'image_url', 'naver_map_url', 'lat', 'lng'];
      
      fields.forEach(field => {
        let colIdx = headers.indexOf(field);
        
        // 필드가 시트에 없으면 컬럼 추가
        if (colIdx === -1) {
          colIdx = headers.length;
          sheet.getRange(1, colIdx + 1).setValue(field);
          headers.push(field);
        }
        
        let value = requestData[field];
        if (value === undefined) value = '';
        if (field === 'solo_ok' || field === 'group_ok' || field === 'indoor_ok') {
          value = value === true || value === 'true' || value === 'TRUE' || value === 1 || value === '1';
        }
        sheet.getRange(row, colIdx + 1).setValue(value);
      });
      
      // updated_at 갱신
      const updatedAtCol = headers.indexOf('updated_at');
      if (updatedAtCol !== -1) {
        sheet.getRange(row, updatedAtCol + 1).setValue(now);
      }
      
      return { success: true, data: { place_id: placeId, updated_at: now } };
    }
  }
  return { success: false, error: '해당 장소를 찾을 수 없습니다.' };
}

// DELETE /places/:id - 장소 삭제
function deletePlace(placeId) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('places');
  if (!sheet) return { success: false, error: 'places 시트를 찾을 수 없습니다.' };
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const idCol = headers.indexOf('place_id');
  if (idCol === -1) return { success: false, error: 'place_id 컬럼을 찾을 수 없습니다.' };
  for (let i = data.length - 1; i >= 1; i--) {
    if (data[i][idCol] === placeId) {
      sheet.deleteRow(i + 1);
      return { success: true };
    }
  }
  return { success: false, error: '해당 장소를 찾을 수 없습니다.' };
}

// GET /config - 설정 조회
function getConfig() {
  const configs = getSheetData('config');
  return { success: true, data: configs };
}

// POST /config - 설정 저장/업데이트
function updateConfig(requestData) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName('config');
  if (!sheet) {
    sheet = ss.insertSheet('config');
    sheet.getRange(1, 1, 1, 2).setValues([['key', 'value']]);
  }
  const key = requestData.key;
  const value = requestData.value;
  if (!key) return { success: false, error: 'key가 필요합니다.' };
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === key) {
      sheet.getRange(i + 1, 2).setValue(value);
      return { success: true, data: { key: key, value: value } };
    }
  }
  sheet.appendRow([key, value]);
  return { success: true, data: { key: key, value: value } };
}

// POST /upload-image - Google Drive에 이미지 업로드
function uploadImage(requestData) {
  const base64 = requestData.image_base64;
  const filename = requestData.filename || 'place_image.jpg';
  const placeId = requestData.place_id || '';
  if (!base64) return { success: false, error: 'image_base64가 필요합니다.' };
  try {
    var folders = DriveApp.getFoldersByName('lunch-images');
    var folder;
    if (folders.hasNext()) {
      folder = folders.next();
    } else {
      folder = DriveApp.createFolder('lunch-images');
      // 폴더도 공유 설정 (파일 접근을 위해)
      folder.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    }
    var decoded = Utilities.base64Decode(base64);
    var blob = Utilities.newBlob(decoded, 'image/jpeg', filename);
    var file = folder.createFile(blob);
    // 파일 공유 설정 (링크가 있는 사람은 볼 수 있음)
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    var fileId = file.getId();
    var imageUrl = 'https://drive.google.com/uc?id=' + fileId;
    if (placeId) {
      var ss = SpreadsheetApp.getActiveSpreadsheet();
      var sheet = ss.getSheetByName('places');
      if (sheet) {
        var data = sheet.getDataRange().getValues();
        var headers = data[0];
        var idCol = headers.indexOf('place_id');
        var imgCol = headers.indexOf('image_url');
        if (imgCol === -1) {
          imgCol = headers.length;
          sheet.getRange(1, imgCol + 1).setValue('image_url');
        }
        if (idCol !== -1) {
          for (var i = 1; i < data.length; i++) {
            if (data[i][idCol] === placeId) {
              sheet.getRange(i + 1, imgCol + 1).setValue(imageUrl);
              break;
            }
          }
        }
      }
    }
    return { success: true, data: { image_url: imageUrl, file_id: fileId } };
  } catch (e) {
    return { success: false, error: e.toString() };
  }
}

// GET /daily-recommendations - 오늘의 추천 조회
function getDailyRecommendations() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('daily_recommendations');
  if (!sheet) return { success: true, data: null };
  var today = Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd');
  var data = sheet.getDataRange().getValues();
  if (data.length < 2) return { success: true, data: null };
  var headers = data[0];
  var dateCol = headers.indexOf('date');
  var jsonCol = headers.indexOf('recommendations_json');
  if (dateCol === -1 || jsonCol === -1) return { success: true, data: null };
  for (var i = data.length - 1; i >= 1; i--) {
    var rowDate = data[i][dateCol];
    if (typeof rowDate === 'object' && rowDate.getTime) {
      rowDate = Utilities.formatDate(rowDate, 'Asia/Seoul', 'yyyy-MM-dd');
    }
    if (String(rowDate) === today) {
      try {
        var recs = JSON.parse(data[i][jsonCol]);
        return { success: true, data: recs };
      } catch (e) {
        return { success: true, data: null };
      }
    }
  }
  return { success: true, data: null };
}

// POST /generate-daily - 일일 추천 생성
function generateDaily(requestData) {
  var result = recommendLunch(requestData || { text: '오늘의 점심 추천', preset: [], exclude: [] });
  if (!result.success || !result.data) return result;
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('daily_recommendations');
  if (!sheet) {
    sheet = ss.insertSheet('daily_recommendations');
    sheet.getRange(1, 1, 1, 3).setValues([['date', 'recommendations_json', 'created_at']]);
  }
  var today = Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd');
  var data = sheet.getDataRange().getValues();
  var dateCol = 0;
  var replaced = false;
  for (var i = 1; i < data.length; i++) {
    var rowDate = data[i][dateCol];
    if (typeof rowDate === 'object' && rowDate.getTime) {
      rowDate = Utilities.formatDate(rowDate, 'Asia/Seoul', 'yyyy-MM-dd');
    }
    if (String(rowDate) === today) {
      sheet.getRange(i + 1, 2).setValue(JSON.stringify(result.data));
      sheet.getRange(i + 1, 3).setValue(new Date().toISOString());
      replaced = true;
      break;
    }
  }
  if (!replaced) {
    sheet.appendRow([today, JSON.stringify(result.data), new Date().toISOString()]);
  }
  return { success: true, data: result.data };
}

// POST /reviews - 리뷰 등록
function createReview(requestData) {
  const reviewId = generateId('review');
  const now = new Date().toISOString();
  
  const reviewData = {
    review_id: reviewId,
    place_id: requestData.place_id || '',
    verdict: requestData.verdict || 'neutral',
    reasons: requestData.reasons || '',
    comment: requestData.comment || '',
    created_at: now
  };
  
  appendSheetData('reviews', reviewData);
  
  return {
    success: true,
    data: {
      review_id: reviewId,
      created_at: now
    }
  };
}

// 리뷰 집계 (place_id별)
function aggregateReviews(placeId) {
  const reviews = getSheetData('reviews');
  const placeReviews = reviews.filter(r => r.place_id === placeId);
  
  if (placeReviews.length === 0) {
    return {
      total: 0,
      good: 0,
      bad: 0,
      neutral: 0,
      average: 0
    };
  }
  
  const good = placeReviews.filter(r => r.verdict === 'good').length;
  const bad = placeReviews.filter(r => r.verdict === 'bad').length;
  const neutral = placeReviews.filter(r => r.verdict === 'neutral').length;
  
  // 평균 점수 계산 (good=1, neutral=0.5, bad=0)
  const average = (good * 1 + neutral * 0.5) / placeReviews.length;
  
  return {
    total: placeReviews.length,
    good: good,
    bad: bad,
    neutral: neutral,
    average: average
  };
}

// 규칙 기반 점수 계산
function calculateScore(place, preset, reviewStats) {
  let score = 0;
  
  // 프리셋 매칭 점수
  if (preset.includes('solo_ok') && place.solo_ok) score += 10;
  if (preset.includes('group_ok') && place.group_ok) score += 10;
  if (preset.includes('indoor_ok') && place.indoor_ok) score += 10;
  
  // 리뷰 평균 점수 (0-10점)
  score += reviewStats.average * 10;
  
  // 최근 리뷰 가중치 (리뷰가 많을수록 높은 점수)
  score += Math.min(reviewStats.total * 0.5, 5);
  
  // 거리 가중치 (가까울수록 높은 점수)
  if (place.walk_min) {
    score += Math.max(10 - place.walk_min, 0);
  }
  
  return score;
}

// POST /recommend - 점심 추천
function recommendLunch(requestData) {
  const text = requestData.text || '';
  const preset = requestData.preset || [];
  const exclude = requestData.exclude || [];
  
  if (!text) {
    return {
      success: false,
      error: 'text 필드는 필수입니다'
    };
  }
  
  // 1. 모든 장소 가져오기
  const places = getSheetData('places');
  
  // 2. 제외 목록 필터링
  const filteredPlaces = places.filter(p => !exclude.includes(p.place_id));
  
  // 3. 리뷰 집계 및 점수 계산
  const scoredPlaces = filteredPlaces.map(place => {
    const reviewStats = aggregateReviews(place.place_id);
    const score = calculateScore(place, preset, reviewStats);
    
    return {
      ...place,
      reviewStats: reviewStats,
      score: score
    };
  });
  
  // 4. 점수 순으로 정렬하여 상위 50개 shortlist 생성
  const shortlist = scoredPlaces
    .sort((a, b) => b.score - a.score)
    .slice(0, 50);
  
  // 5. LLM 호출 (키가 있으면)
  const perplexityKey = getPerplexityApiKey();
  
  if (perplexityKey && shortlist.length > 0) {
    try {
      const llmResult = callPerplexityAPI(text, shortlist, perplexityKey);
      if (llmResult && llmResult.length > 0) {
        // reco_logs에 기록
        logRecommendation(text, preset, exclude, llmResult.map(r => r.place_id));
        return {
          success: true,
          data: llmResult
        };
      }
    } catch (error) {
      console.error('LLM 호출 실패:', error);
      // 폴백으로 진행
    }
  }
  
  // 6. 폴백: 상위 3개 반환
  const top3 = shortlist.slice(0, 3).map(place => ({
    place_id: place.place_id,
    name: place.name,
    address_text: place.address_text,
    naver_map_url: place.naver_map_url,
    category: place.category,
    price_level: place.price_level,
    tags: place.tags,
    walk_min: place.walk_min,
    reason: `리뷰 점수 ${place.reviewStats.average.toFixed(1)}점, 총 ${place.reviewStats.total}개 리뷰`
  }));
  
  // reco_logs에 기록
  logRecommendation(text, preset, exclude, top3.map(p => p.place_id));
  
  return {
    success: true,
    data: top3
  };
}

// Perplexity API 호출
function callPerplexityAPI(text, shortlist, apiKey) {
  const url = 'https://api.perplexity.ai/chat/completions';
  
  // shortlist를 JSON 문자열로 변환 (간소화)
  const placesSummary = shortlist.slice(0, 20).map(p => ({
    place_id: p.place_id,
    name: p.name,
    category: p.category,
    tags: p.tags,
    walk_min: p.walk_min,
    solo_ok: p.solo_ok,
    group_ok: p.group_ok,
    indoor_ok: p.indoor_ok,
    review_average: p.reviewStats.average
  }));
  
  const prompt = `다음은 점심 식당 후보 목록입니다. 사용자의 요청에 가장 적합한 Top 3를 선택하고, 각각에 대해 1문장으로 이유를 설명하세요.

사용자 요청: "${text}"

후보 목록:
${JSON.stringify(placesSummary, null, 2)}

**중요 제약사항:**
1. 반드시 위 후보 목록의 place_id만 사용해야 합니다.
2. 각 추천에 대해 reason 필드에 1문장으로 이유를 작성하세요.
3. JSON 형식으로만 응답하세요.

응답 형식:
{
  "recommendations": [
    {
      "place_id": "place_123",
      "reason": "이유 1문장"
    }
  ]
}`;
  
  const options = {
    method: 'post',
    headers: {
      'Authorization': 'Bearer ' + apiKey,
      'Content-Type': 'application/json'
    },
    payload: JSON.stringify({
      model: 'sonar-pro',
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.3,
      max_tokens: 500
    })
  };
  
  try {
    const response = UrlFetchApp.fetch(url, options);
    const responseData = JSON.parse(response.getContentText());
    
    if (responseData.choices && responseData.choices[0] && responseData.choices[0].message) {
      const content = responseData.choices[0].message.content;
      
      // JSON 추출
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        
        if (parsed.recommendations && Array.isArray(parsed.recommendations)) {
          // place_id로 전체 정보 매칭
          return parsed.recommendations.map(rec => {
            const place = shortlist.find(p => p.place_id === rec.place_id);
            if (place) {
              return {
                place_id: place.place_id,
                name: place.name,
                address_text: place.address_text,
                naver_map_url: place.naver_map_url,
                category: place.category,
                price_level: place.price_level,
                tags: place.tags,
                walk_min: place.walk_min,
                reason: rec.reason || '추천'
              };
            }
            return null;
          }).filter(p => p !== null).slice(0, 3);
        }
      }
    }
    
    return null;
  } catch (error) {
    console.error('Perplexity API 호출 오류:', error);
    return null;
  }
}

// 추천 로그 기록
function logRecommendation(text, preset, exclude, resultPlaceIds) {
  const logData = {
    log_id: generateId('log'),
    text: text,
    preset: JSON.stringify(preset),
    exclude: JSON.stringify(exclude),
    result_place_ids: JSON.stringify(resultPlaceIds),
    created_at: new Date().toISOString()
  };
  
  appendSheetData('reco_logs', logData);
}

// 메인 doPost 함수 (웹 앱으로 배포)
function doPost(e) {
  return handleRequest(e);
}

function doGet(e) {
  return handleRequest(e);
}

function handleRequest(e) {
  try {
    const request = e;
    const path = request.parameter.path || '';
    const method = request.parameter.method || (e.postData ? 'POST' : 'GET');
    
    // 인증 검증
    const authError = validateApiKey(request);
    if (authError) {
      return ContentService.createTextOutput(JSON.stringify(authError))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    let result;
    
    // 라우팅
    if (path === 'places' && method === 'GET') {
      result = getPlaces();
    } else if (path === 'places' && method === 'POST') {
      const requestData = e.postData ? JSON.parse(e.postData.contents) : {};
      result = createPlace(requestData);
    } else if (path.startsWith('places/') && method === 'PUT') {
      const placeId = path.replace('places/', '');
      const requestData = e.postData ? JSON.parse(e.postData.contents) : {};
      result = updatePlace(placeId, requestData);
    } else if (path.startsWith('places/') && method === 'DELETE') {
      const placeId = path.replace('places/', '');
      result = deletePlace(placeId);
    } else if (path === 'reviews' && method === 'POST') {
      const requestData = e.postData ? JSON.parse(e.postData.contents) : {};
      result = createReview(requestData);
    } else if (path === 'recommend' && method === 'POST') {
      const requestData = e.postData ? JSON.parse(e.postData.contents) : {};
      result = recommendLunch(requestData);
    } else if (path === 'config' && method === 'GET') {
      result = getConfig();
    } else if (path === 'config' && method === 'POST') {
      const requestData = e.postData ? JSON.parse(e.postData.contents) : {};
      result = updateConfig(requestData);
    } else if (path === 'upload-image' && method === 'POST') {
      const requestData = e.postData ? JSON.parse(e.postData.contents) : {};
      result = uploadImage(requestData);
    } else if (path === 'daily-recommendations' && method === 'GET') {
      result = getDailyRecommendations();
    } else if (path === 'generate-daily' && method === 'POST') {
      const requestData = e.postData ? JSON.parse(e.postData.contents) : {};
      result = generateDaily(requestData);
    } else {
      result = {
        success: false,
        error: '알 수 없는 엔드포인트'
      };
    }
    
    return ContentService.createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);
      
  } catch (error) {
    console.error('요청 처리 오류:', error);
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}
