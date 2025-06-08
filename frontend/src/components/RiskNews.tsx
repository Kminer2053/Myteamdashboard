import React, { useState, useEffect } from 'react';
import axios from 'axios';

interface RiskNewsProps {
  type: string;
  onRefresh: () => void;
}

const RiskNews: React.FC<RiskNewsProps> = (props) => {
  const { type, onRefresh } = props;
  const [news, setNews] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchNews = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`/api/news/${type}`);
      setNews(response.data);
      setError(null);
    } catch (err) {
      setError('뉴스를 불러오는데 실패했습니다.');
      console.error('Error fetching news:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNews();
  }, [type]);

  const handleRefresh = async () => {
    try {
      await axios.post(`/api/news/refresh/${type}`);
      await fetchNews();
      onRefresh();
    } catch (err) {
      setError('뉴스 갱신에 실패했습니다.');
      console.error('Error refreshing news:', err);
    }
  };

  if (loading) return <div>로딩 중...</div>;
  if (error) return <div className="error">{error}</div>;

  return (
    <div className="news-container">
      <div className="news-header">
        <h3>리스크 뉴스</h3>
        <button onClick={handleRefresh} className="refresh-button">
          정보갱신
        </button>
      </div>
      <div className="news-list">
        {news.map((item, index) => (
          <div key={index} className="news-item">
            <h4>{item.title}</h4>
            <p>{item.description}</p>
            <a href={item.link} target="_blank" rel="noopener noreferrer">
              자세히 보기
            </a>
          </div>
        ))}
      </div>
    </div>
  );
};

export default RiskNews; 