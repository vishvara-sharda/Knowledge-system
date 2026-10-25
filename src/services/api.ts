import type {
  Workspace,
  KnowledgeNode,
  Connection,
  Tag,
  ViewportSettings,
  WorkspaceGraphResponse,
} from '../types';

const API_BASE = '/api';

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let errorMsg = `HTTP Error ${res.status}`;
    try {
      const errorData = await res.json();
      if (errorData && (errorData as any).error) {
        errorMsg = (errorData as any).error;
      }
    } catch {
      // fallback to status text
      errorMsg = res.statusText || errorMsg;
    }
    throw new Error(errorMsg);
  }
  return res.json() as Promise<T>;
}

export const api = {
  // Workspaces
  async getWorkspaces(): Promise<Workspace[]> {
    const res = await fetch(`${API_BASE}/workspaces`);
    return handleResponse<Workspace[]>(res);
  },

  async createWorkspace(name: string): Promise<Workspace> {
    const res = await fetch(`${API_BASE}/workspaces`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    return handleResponse<Workspace>(res);
  },

  async updateWorkspace(id: string, name: string): Promise<{ success: boolean }> {
    const res = await fetch(`${API_BASE}/workspaces/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    return handleResponse<{ success: boolean }>(res);
  },

  async getWorkspaceGraph(workspaceId: string): Promise<WorkspaceGraphResponse> {
    const res = await fetch(`${API_BASE}/workspaces/${workspaceId}/graph`);
    return handleResponse<WorkspaceGraphResponse>(res);
  },

  async saveViewport(workspaceId: string, viewport: ViewportSettings): Promise<{ success: boolean }> {
    const res = await fetch(`${API_BASE}/workspaces/${workspaceId}/viewport`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(viewport),
    });
    return handleResponse<{ success: boolean }>(res);
  },

  // Nodes
  async createNode(node: {
    id?: string;
    workspace_id: string;
    title: string;
    content?: string;
    position_x?: number;
    position_y?: number;
    width?: number;
    height?: number;
    color?: string;
    tags?: string[];
  }): Promise<KnowledgeNode> {
    const res = await fetch(`${API_BASE}/nodes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(node),
    });
    return handleResponse<KnowledgeNode>(res);
  },

  async updateNode(id: string, updates: Partial<KnowledgeNode>): Promise<KnowledgeNode> {
    const res = await fetch(`${API_BASE}/nodes/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    return handleResponse<KnowledgeNode>(res);
  },

  async batchUpdateNodePositions(
    positions: { id: string; position_x: number; position_y: number }[]
  ): Promise<{ success: boolean; count: number }> {
    const res = await fetch(`${API_BASE}/nodes/batch-positions`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ positions }),
    });
    return handleResponse<{ success: boolean; count: number }>(res);
  },

  async deleteNode(id: string): Promise<{ success: boolean; id: string }> {
    const res = await fetch(`${API_BASE}/nodes/${id}`, {
      method: 'DELETE',
    });
    return handleResponse<{ success: boolean; id: string }>(res);
  },

  // Connections
  async createConnection(conn: {
    id?: string;
    workspace_id: string;
    source_node_id: string;
    target_node_id: string;
    relationship?: string;
  }): Promise<Connection> {
    const res = await fetch(`${API_BASE}/connections`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(conn),
    });
    return handleResponse<Connection>(res);
  },

  async deleteConnection(id: string): Promise<{ success: boolean; id: string }> {
    const res = await fetch(`${API_BASE}/connections/${id}`, {
      method: 'DELETE',
    });
    return handleResponse<{ success: boolean; id: string }>(res);
  },

  // Search
  async searchNodes(workspaceId: string, query: string): Promise<KnowledgeNode[]> {
    const res = await fetch(
      `${API_BASE}/search?workspace_id=${encodeURIComponent(workspaceId)}&q=${encodeURIComponent(query)}`
    );
    return handleResponse<KnowledgeNode[]>(res);
  },

  // Tags
  async getTags(workspaceId: string): Promise<Tag[]> {
    const res = await fetch(`${API_BASE}/tags?workspace_id=${encodeURIComponent(workspaceId)}`);
    return handleResponse<Tag[]>(res);
  },

  async createTag(workspaceId: string, name: string): Promise<Tag> {
    const res = await fetch(`${API_BASE}/tags`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workspace_id: workspaceId, name }),
    });
    return handleResponse<Tag>(res);
  },
};
