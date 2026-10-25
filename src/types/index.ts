export interface Workspace {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
}

export interface KnowledgeNode {
  id: string;
  workspace_id: string;
  title: string;
  content: string | null;
  position_x: number;
  position_y: number;
  width?: number;
  height?: number;
  color?: string;
  is_favorite: number;
  is_deleted: number;
  created_at: string;
  updated_at: string;
  tags?: string[];
}

export interface Connection {
  id: string;
  workspace_id: string;
  source_node_id: string;
  target_node_id: string;
  relationship: string | null;
  created_at: string;
}

export interface Tag {
  id: string;
  workspace_id: string;
  name: string;
  created_at?: string;
}

export interface ViewportSettings {
  viewport_x: number;
  viewport_y: number;
  zoom: number;
}

export interface WorkspaceGraphResponse {
  workspace: Workspace;
  nodes: KnowledgeNode[];
  connections: Connection[];
  tags: Tag[];
  viewport: ViewportSettings;
}

export type SaveStatus = 'saved' | 'saving' | 'error';
