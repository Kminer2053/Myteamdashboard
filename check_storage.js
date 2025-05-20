console.log('현재 저장된 techNews 데이터:'); console.log(JSON.parse(localStorage.getItem('techNews_' + new Date().toISOString().split('T')[0])));
