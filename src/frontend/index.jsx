import React, { useEffect, useState } from 'react';
import ForgeReconciler, {
  Box,
  Heading,
  Label,
  LoadingButton,
  Lozenge,
  SectionMessage,
  Select,
  Spinner,
  Stack,
  Strong,
  Text,
} from '@forge/react';
import { invoke } from '@forge/bridge';

function App() {
  const [orgUsers, setOrgUsers] = useState([]);
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [hasMoreUsers, setHasMoreUsers] = useState(false);
  const [isTruncated, setIsTruncated] = useState(false);
  const [unlinking, setUnlinking] = useState(false);
  const [unlinkResults, setUnlinkResults] = useState([]);
  const [unlinkSummary, setUnlinkSummary] = useState(null);

  useEffect(() => {
    let isMounted = true;

    const loadOrgUsers = async () => {
      setLoading(true);
      setError('');

      try {
        const response = await invoke('getOrgUsersForPicker');

        if (!isMounted) {
          return;
        }

        if (!response?.ok) {
          setOrgUsers([]);
          setError(response?.error || 'Failed to load organization users.');
          return;
        }

        setOrgUsers(Array.isArray(response.users) ? response.users : []);
        setHasMoreUsers(Boolean(response.hasMore));
        setIsTruncated(Boolean(response.truncated));
      } catch (requestError) {
        if (!isMounted) {
          return;
        }

        setOrgUsers([]);
        setError(
          requestError.message || 'An error occurred while loading organization users.'
        );
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadOrgUsers();

    return () => {
      isMounted = false;
    };
  }, []);

  const userOptions = orgUsers.map((user) => ({
    label: `${user.displayName} (${user.secondaryText})`,
    value: user.accountId,
  }));

  const handleUnlink = async () => {
    setUnlinking(true);
    setUnlinkResults([]);
    setUnlinkSummary(null);
    setError('');

    try {
      const usersToUnlink = selectedUsers
        .map((selectedUser) =>
          orgUsers.find((user) => user.accountId === selectedUser.value)
        )
        .filter(Boolean);

      const response = await invoke('unlinkSelectedUsers', {
        users: usersToUnlink,
      });

      if (!response?.ok) {
        setError(response?.error || 'Failed to unlink selected users.');
        return;
      }

      setUnlinkResults(Array.isArray(response.results) ? response.results : []);
      setUnlinkSummary(response.summary || null);
    } catch (requestError) {
      setError(requestError.message || 'An error occurred while unlinking users.');
    } finally {
      setUnlinking(false);
    }
  };

  return (
    <Stack space="space.300">
      <Box>
        <Heading size="large">SCIM unlink user picker</Heading>
        <Text>
          This picker loads organization users only and lets you search and select
          multiple entries.
        </Text>
      </Box>

      {error ? (
        <SectionMessage appearance="error" title="Could not load users">
          <Text>{error}</Text>
        </SectionMessage>
      ) : null}

      {hasMoreUsers || isTruncated ? (
        <SectionMessage
          appearance="warning"
          title="Only part of the organization was loaded"
        >
          <Text>
            The picker currently loads up to 500 organization users. If the
            organization is larger, the next step should be a server-side org
            search flow.
          </Text>
        </SectionMessage>
      ) : null}

      <Box>
        <Label labelFor="org-user-picker">Organization users</Label>
        {loading ? (
          <Spinner label="Loading organization users" />
        ) : (
          <Select
            inputId="org-user-picker"
            isMulti
            isSearchable
            options={userOptions}
            value={selectedUsers}
            onChange={(value) => {
              if (Array.isArray(value)) {
                setSelectedUsers(value);
                return;
              }

              setSelectedUsers(value ? [value] : []);
            }}
            placeholder="Search by name or email and choose users"
          />
        )}
      </Box>

      <Box>
        <Heading size="medium">Selected users</Heading>
        {selectedUsers.length === 0 ? (
          <Text>No users selected yet.</Text>
        ) : (
          <Stack space="space.100">
            {selectedUsers.map((selectedUser) => {
              const matchedUser = orgUsers.find(
                (user) => user.accountId === selectedUser.value
              );

              return (
                <Box key={selectedUser.value}>
                  <Text>
                    <Strong>{matchedUser?.displayName || selectedUser.label}</Strong>{' '}
                    <Lozenge appearance="default">
                      {matchedUser?.accountStatus || 'unknown'}
                    </Lozenge>
                  </Text>
                  <Text>{matchedUser?.secondaryText || selectedUser.value}</Text>
                </Box>
              );
            })}
          </Stack>
        )}
      </Box>

      <Box>
        <LoadingButton
          appearance="danger"
          isLoading={unlinking}
          isDisabled={selectedUsers.length === 0 || unlinking}
          onClick={handleUnlink}
        >
          Unlink selected users
        </LoadingButton>
      </Box>

      {unlinkSummary ? (
        <SectionMessage
          appearance={unlinkSummary.failed > 0 ? 'warning' : 'confirmation'}
          title="Unlink result"
        >
          <Text>
            Total: {unlinkSummary.total}, succeeded: {unlinkSummary.succeeded},
            failed: {unlinkSummary.failed}
          </Text>
        </SectionMessage>
      ) : null}

      {unlinkResults.length > 0 ? (
        <Box>
          <Heading size="medium">Per-user results</Heading>
          <Stack space="space.100">
            {unlinkResults.map((result) => (
              <Box key={`${result.accountId}-${result.displayName}`}>
                <Text>
                  <Strong>{result.displayName}</Strong>{' '}
                  <Lozenge appearance={result.ok ? 'success' : 'removed'}>
                    {result.ok ? 'success' : 'failed'}
                  </Lozenge>
                </Text>
                <Text>{result.message}</Text>
                {result.details ? <Text>{result.details}</Text> : null}
              </Box>
            ))}
          </Stack>
        </Box>
      ) : null}
    </Stack>
  );
}

ForgeReconciler.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
