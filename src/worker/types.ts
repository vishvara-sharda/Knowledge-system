export interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  first<T = unknown>(colName?: string): Promise<T | null>;
  run<T = unknown>(): Promise<{ success: boolean; results?: T[]; meta?: any }>;
  all<T = unknown>(): Promise<{ success: boolean; results?: T[]; meta?: any }>;
}

export interface D1Database {
  prepare(query: string): D1PreparedStatement;
  batch<T = unknown>(statements: D1PreparedStatement[]): Promise<{ success: boolean; results?: T[] }[]>;
  exec(query: string): Promise<{ count: number; duration: number }>;
}

export interface Fetcher {
  fetch(request: Request): Promise<Response>;
}

export interface Env {
  DB: D1Database;
  ASSETS?: Fetcher;
}

export interface WorkspaceRecord {
  id: string;
  name: string;
  color?: string;
  created_at: string;
  updated_at: string;
}

export interface NodeRecord {
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

export interface ConnectionRecord {
  id: string;
  workspace_id: string;
  source_node_id: string;
  target_node_id: string;
  relationship: string | null;
  created_at: string;
}

export interface TagRecord {
  id: string;
  workspace_id: string;
  name: string;
  created_at: string;
}

export interface WorkspaceSettingsRecord {
  workspace_id: string;
  viewport_x: number;
  viewport_y: number;
  zoom: number;
  updated_at: string;
}
