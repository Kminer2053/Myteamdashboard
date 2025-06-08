import React, { useState } from 'react';
import RiskNews from '../components/RiskNews';

const NewsPage: React.FC = () => {
  const [refreshCount, setRefreshCount] = useState(0);

  const handleRefresh = () => {
    setRefreshCount(prevCount => prevCount + 1);
  };

  return (
    <div className="news-page">
      <div className="news-section">
        <h2>리스크 뉴스</h2>
        <RiskNews type="risk" onRefresh={handleRefresh} />
      </div>
    </div>
  );
};

export default NewsPage; 