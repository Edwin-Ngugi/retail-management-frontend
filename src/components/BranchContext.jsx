// src/context/BranchContext.jsx
import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import API from '../api';

// 1. Export the context directly as a named export
export const BranchContext = createContext();

export function BranchProvider({ children }) {
  const [branches, setBranches] = useState([]);
  const [selectedBranch, setSelectedBranch] = useState(
    localStorage.getItem('selectedBranchId') || ''
  );
  const [loadingBranches, setLoadingBranches] = useState(true);

  // Fetch branches from backend
  const fetchBranches = useCallback(async () => {
    try {
      setLoadingBranches(true);
      const res = await API.get('branches/');
      const list = Array.isArray(res.data) ? res.data : res.data?.results || [];
      setBranches(list);

      if (list.length > 0) {
        const storedBranchExists = list.some((b) => b.id.toString() === selectedBranch.toString());
        if (!selectedBranch || !storedBranchExists) {
          const defaultId = list[0].id.toString();
          setSelectedBranch(defaultId);
          localStorage.setItem('selectedBranchId', defaultId);
        }
      } else {
        setSelectedBranch('');
        localStorage.removeItem('selectedBranchId');
      }
    } catch (err) {
      console.error('Failed to fetch retail branches:', err);
    } finally {
      setLoadingBranches(false);
    }
  }, [selectedBranch]);

  useEffect(() => {
    fetchBranches();
  }, []);

  const changeBranch = (branchId) => {
    const idString = branchId.toString();
    setSelectedBranch(idString);
    localStorage.setItem('selectedBranchId', idString);
  };

  const activeBranchObject = useMemo(() => {
    return branches.find((b) => b.id.toString() === selectedBranch.toString()) || null;
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