// src/context/BranchContext.jsx
import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import API from '../api';

// 1. Export the context directly as a named export
export const BranchContext = createContext();

export function BranchProvider({ children }) {
  const [branches, setBranches] = useState([]);
  const [selectedBranch, setSelectedBranch] = useState(
    () => localStorage.getItem('selectedBranchId') || ''
  );
  const [loadingBranches, setLoadingBranches] = useState(true);

  // Helper for safe string comparison
  const matchId = (a, b) => String(a ?? '') === String(b ?? '');

  // Fetch branches from backend
  const fetchBranches = useCallback(async () => {
    try {
      setLoadingBranches(true);
      // Relative path guarantees concatenation with API.defaults.baseURL (/api/)
      const res = await API.get('branches/');
      const list = Array.isArray(res.data) ? res.data : res.data?.results || [];
      setBranches(list);

      if (list.length > 0) {
        setSelectedBranch((prevSelected) => {
          const storedBranchExists = list.some((b) => matchId(b.id, prevSelected));
          if (!prevSelected || !storedBranchExists) {
            const defaultId = String(list[0].id);
            localStorage.setItem('selectedBranchId', defaultId);
            return defaultId;
          }
          return prevSelected;
        });
      } else {
        setSelectedBranch('');
        localStorage.removeItem('selectedBranchId');
      }
    } catch (err) {
      console.error('Failed to fetch retail branches:', err);
    } finally {
      setLoadingBranches(false);
    }
  }, []); // Empty dependency array prevents re-creation loops

  useEffect(() => {
    fetchBranches();
  }, [fetchBranches]);

  const changeBranch = (branchId) => {
    const idString = String(branchId ?? '');
    setSelectedBranch(idString);
    localStorage.setItem('selectedBranchId', idString);
  };

  const activeBranchObject = useMemo(() => {
    return branches.find((b) => matchId(b.id, selectedBranch)) || null;
  }, [branches, selectedBranch]);

  return (
    <BranchContext.Provider
      value={{
        branches,
        selectedBranch,
        activeBranch: activeBranchObject,
        setSelectedBranch: changeBranch,
        refreshBranches: fetchBranches,
        loadingBranches,
      }}
    >
      {children}
    </BranchContext.Provider>
  );
}

export const useBranch = () => useContext(BranchContext);

// 2. Export context as default export as well to prevent import errors across files
export default BranchContext;