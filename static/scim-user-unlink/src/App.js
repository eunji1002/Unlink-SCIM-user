import React, { useEffect, useState } from 'react';
import { invoke } from '@forge/bridge';

export default function App() {
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [searchError, setSearchError] = useState('');

  const handleLoad = async () => {
    setLoading(true);

    try {
      const res = await invoke('listOrgUsers', { limit: 20 });
      setResult(res);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async () => {
    const trimmedQuery = searchQuery.trim();

    if (!trimmedQuery) {
      setSearchResults([]);
      setSearchError('');
      return;
    }

    setSearching(true);
    setSearchError('');

    try {
      const res = await invoke('searchJiraUsers', {
        query: trimmedQuery,
        maxResults: 10,
      });

      if (!res?.ok) {
        setSearchResults([]);
        setSearchError(res?.error || '사용자 검색에 실패했습니다.');
        return;
      }

      setSearchResults(res.users || []);
    } catch (error) {
      setSearchResults([]);
      setSearchError(error.message || '사용자 검색 중 오류가 발생했습니다.');
    } finally {
      setSearching(false);
    }
  };

  useEffect(() => {
    const trimmedQuery = searchQuery.trim();

    if (!trimmedQuery) {
      setSearchResults([]);
      setSearchError('');
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      handleSearch();
    }, 300);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [searchQuery]);

  const handleAddUser = (user) => {
    setSelectedUsers((currentUsers) => {
      const alreadySelected = currentUsers.some(
        (currentUser) => currentUser.accountId === user.accountId
      );

      if (alreadySelected) {
        return currentUsers;
      }

      return [...currentUsers, user];
    });
  };

  const handleRemoveUser = (accountId) => {
    setSelectedUsers((currentUsers) =>
      currentUsers.filter((user) => user.accountId !== accountId)
    );
  };

  return (
    <div style={{ padding: 24, fontFamily: 'Arial, sans-serif' }}>
      <h2>Org users test</h2>

      <section style={{ marginBottom: 24 }}>
        <h3>Unlink 대상 사용자 선택</h3>

        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <input
            type="text"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                handleSearch();
              }
            }}
            placeholder="이름 또는 이메일로 Jira 사용자 검색"
            style={{
              flex: 1,
              padding: '10px 12px',
              border: '1px solid #c1c7d0',
              borderRadius: 6,
            }}
          />
          <button onClick={handleSearch} disabled={searching || !searchQuery.trim()}>
            {searching ? '검색 중...' : '검색'}
          </button>
        </div>

        {searchError ? (
          <p style={{ color: '#c9372c', marginTop: 0 }}>{searchError}</p>
        ) : null}

        <div
          style={{
            border: '1px solid #dfe1e6',
            borderRadius: 8,
            padding: 12,
            marginBottom: 16,
            backgroundColor: '#fafbfc',
          }}
        >
          <strong>검색 결과</strong>
          {searchResults.length === 0 ? (
            <p style={{ marginBottom: 0 }}>
              검색어를 입력한 뒤 사용자를 검색해 주세요.
            </p>
          ) : (
            <ul style={{ listStyle: 'none', padding: 0, margin: '12px 0 0 0' }}>
              {searchResults.map((user) => {
                const isSelected = selectedUsers.some(
                  (selectedUser) => selectedUser.accountId === user.accountId
                );

                return (
                  <li
                    key={user.accountId}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: 12,
                      padding: '8px 0',
                      borderBottom: '1px solid #ebecf0',
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 600 }}>{user.displayName}</div>
                      <div style={{ fontSize: 13, color: '#5e6c84' }}>
                        {user.emailAddress || user.accountId}
                      </div>
                    </div>
                    <button
                      onClick={() => handleAddUser(user)}
                      disabled={isSelected}
                    >
                      {isSelected ? '선택됨' : '추가'}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div
          style={{
            border: '1px solid #dfe1e6',
            borderRadius: 8,
            padding: 12,
            backgroundColor: '#ffffff',
          }}
        >
          <strong>선택된 사용자</strong>
          {selectedUsers.length === 0 ? (
            <p style={{ marginBottom: 0 }}>아직 선택된 사용자가 없습니다.</p>
          ) : (
            <ul style={{ listStyle: 'none', padding: 0, margin: '12px 0 0 0' }}>
              {selectedUsers.map((user) => (
                <li
                  key={user.accountId}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: 12,
                    padding: '8px 0',
                    borderBottom: '1px solid #ebecf0',
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 600 }}>{user.displayName}</div>
                    <div style={{ fontSize: 13, color: '#5e6c84' }}>
                      {user.emailAddress || user.accountId}
                    </div>
                  </div>
                  <button onClick={() => handleRemoveUser(user.accountId)}>
                    제거
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <button onClick={handleLoad} disabled={loading}>
        {loading ? '불러오는 중...' : 'Org 사용자 20명 조회'}
      </button>

      <pre style={{ marginTop: 16, whiteSpace: 'pre-wrap' }}>
        {result ? JSON.stringify(result, null, 2) : ''}
      </pre>
    </div>
  );
}
