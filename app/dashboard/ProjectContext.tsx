"use client";

import { createContext, useContext, useState, useEffect } from "react";
import useSWR from "swr";
import { fetcher } from "@/lib/fetcher";

type Project = { 
  id: number; 
  name: string; 
  description: string; 
  icon: string; 
  color: string; 
  owner_id: number; 
  sort_order: number;
  created_at: string;
  owner_username?: string;
  status?: string;
};

type ProjectContextType = {
  projects: Project[];
  selectedProjectId: number | null;
  setSelectedProjectId: (id: number | null) => void;
  refreshProjects: () => Promise<void>;
  userRole: string;
  userId: string;
  sortMethod: 'manual' | 'name' | 'creator';
  setSortMethod: (method: 'manual' | 'name' | 'creator') => void;
  reorderProjects: (newOrder: Project[]) => Promise<void>;
};

const ProjectContext = createContext<ProjectContextType>({
  projects: [],
  selectedProjectId: null,
  setSelectedProjectId: () => {},
  refreshProjects: async () => {},
  userRole: 'member',
  userId: '',
  sortMethod: 'manual',
  setSortMethod: () => {},
  reorderProjects: async () => {},
});

export function useProjects() {
  return useContext(ProjectContext);
}

export function ProjectProvider({ children, userRole, userId }: { children: React.ReactNode, userRole: string, userId: string }) {
  const { data, mutate } = useSWR('/api/projects', fetcher);
  const [sortMethod, setSortMethodState] = useState<'manual' | 'name' | 'creator'>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('project_sort_method') as any) || 'manual';
    }
    return 'manual';
  });

  const setSortMethod = (method: 'manual' | 'name' | 'creator') => {
    setSortMethodState(method);
    localStorage.setItem('project_sort_method', method);
  };

  const rawProjects: Project[] = data?.projects || [];
  
  // Computed sorted projects
  const projects = [...rawProjects].sort((a, b) => {
    if (sortMethod === 'name') {
      return a.name.localeCompare(b.name, 'zh-TW');
    }
    if (sortMethod === 'creator') {
      const nameA = a.owner_username || '';
      const nameB = b.owner_username || '';
      return nameA.localeCompare(nameB, 'zh-TW');
    }
    // manual or default
    return (a.sort_order || 0) - (b.sort_order || 0);
  });
  
  const [selectedProjectId, setSelectedProjectIdState] = useState<number | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const ch = params.get('channel');
      if (ch) setSelectedProjectIdState(Number(ch));
    }
  }, []);

  const setSelectedProjectId = (id: number | null) => {
    setSelectedProjectIdState(id);
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      if (id === null) {
        url.searchParams.delete('channel');
      } else {
        url.searchParams.set('channel', id.toString());
      }
      window.history.pushState({}, '', url);
    }
  };

  const refreshProjects = async () => {
    await mutate();
  };

  const reorderProjects = async (newOrder: Project[]) => {
    // Optimistic update
    mutate({ projects: newOrder }, false);
    
    try {
      const res = await fetch('/api/projects/reorder', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderedIds: newOrder.map(p => p.id) })
      });
      if (!res.ok) throw new Error('Failed to reorder');
      await mutate();
    } catch (err) {
      console.error(err);
      await mutate(); // rollback
    }
  };

  useEffect(() => {
    if (selectedProjectId && data && !data.projects.find((p: Project) => p.id === selectedProjectId)) {
      setSelectedProjectId(null);
    }
  }, [data, selectedProjectId]);

  return (
    <ProjectContext.Provider value={{ 
      projects, 
      selectedProjectId, 
      setSelectedProjectId, 
      refreshProjects, 
      userRole, 
      userId,
      sortMethod,
      setSortMethod,
      reorderProjects
    }}>
      {children}
    </ProjectContext.Provider>
  );
}
