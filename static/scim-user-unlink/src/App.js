import React, { useState } from 'react';
import { invoke } from '@forge/bridge';

export default function App() {
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleLoad = async () => {
    setLoading(true);
    try {
      const res = await invoke('listOrgUsers', { limit: 20 });
      setResult(res);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: 24 }}>
      <h2>Org users test</h2>
      <button onClick={handleLoad} disabled={loading}>
        {loading ? '불러오는 중...' : 'Org 사용자 20명 조회'}
      </button>

      <pre style={{ marginTop: 16, whiteSpace: 'pre-wrap' }}>
        {result ? JSON.stringify(result, null, 2) : ''}
      </pre>
    </div>
  );
}