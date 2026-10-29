import type { Env, NodeRecord } from './types';

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PATCH, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}

function corsPreflightResponse() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PATCH, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
    },
  });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === 'OPTIONS') {
      return corsPreflightResponse();
    }

    const url = new URL(request.url);
    const path = url.pathname;

    try {
      // 1. Workspaces endpoints
      if (path === '/api/workspaces' && request.method === 'GET') {
        const stmt = env.DB.prepare('SELECT * FROM workspaces ORDER BY created_at DESC');
        const { results } = await stmt.all();

        // If no workspace exists yet, create default workspace automatically
        if (!results || results.length === 0) {
          const defaultId = 'ws-default';
          const now = new Date().toISOString();
          await env.DB.prepare(
            'INSERT INTO workspaces (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)'
          ).bind(defaultId, 'Personal Knowledge Graph', now, now).run();

          return jsonResponse([{
            id: defaultId,
            name: 'Personal Knowledge Graph',
            created_at: now,
            updated_at: now,
          }]);
        }

        return jsonResponse(results);
      }

      if (path === '/api/workspaces' && request.method === 'POST') {
        const body = await request.json() as { id?: string; name: string; color?: string };
        if (!body.name || !body.name.trim()) {
          return jsonResponse({ error: 'Workspace name is required' }, 400);
        }
        const id = body.id || `ws-${crypto.randomUUID()}`;
        const now = new Date().toISOString();
        const color = body.color || '#EF3167';

        try {
          await env.DB.prepare(
            'INSERT INTO workspaces (id, name, color, created_at, updated_at) VALUES (?, ?, ?, ?, ?)'
          ).bind(id, body.name.trim(), color, now, now).run();
        } catch {
          try {
            await env.DB.prepare('ALTER TABLE workspaces ADD COLUMN color TEXT').run();
            await env.DB.prepare(
              'INSERT INTO workspaces (id, name, color, created_at, updated_at) VALUES (?, ?, ?, ?, ?)'
            ).bind(id, body.name.trim(), color, now, now).run();
          } catch {
            await env.DB.prepare(
              'INSERT INTO workspaces (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)'
            ).bind(id, body.name.trim(), now, now).run();
          }
        }

        return jsonResponse({ id, name: body.name.trim(), color, created_at: now, updated_at: now }, 201);
      }

      const workspaceGraphMatch = path.match(/^\/api\/workspaces\/([^/]+)\/graph$/);
      if (workspaceGraphMatch && request.method === 'GET') {
        const workspaceId = workspaceGraphMatch[1];

        // Fetch workspace info
        const wsStmt = env.DB.prepare('SELECT * FROM workspaces WHERE id = ?').bind(workspaceId);
        const workspace = await wsStmt.first();
        if (!workspace) {
          return jsonResponse({ error: 'Workspace not found' }, 404);
        }

        // Fetch nodes (exclude deleted by default unless requested)
        let nodesStmt = env.DB.prepare(
          'SELECT * FROM nodes WHERE workspace_id = ? ORDER BY created_at ASC'
        ).bind(workspaceId);
        let { results: nodesRaw } = await nodesStmt.all();

        // If workspace is empty, seed initial starter graph so it is immediately visual and interactive
        if (!nodesRaw || nodesRaw.length === 0) {
          const now = new Date().toISOString();
          const n1Id = `node-welcome-1`;
          const n2Id = `node-welcome-2`;
          const n3Id = `node-welcome-3`;

          await env.DB.prepare(`
            INSERT INTO nodes (id, workspace_id, title, content, position_x, position_y, width, height, color, is_favorite, is_deleted, created_at, updated_at)
            VALUES 
              (?, ?, 'Dynamic Knowledge Graph', 'Welcome to your visual workspace. Every node represents an idea or concept. Drag nodes anywhere or click to edit notes.', 200, 160, 260, 160, '#ec4899', 1, 0, ?, ?),
              (?, ?, 'Connected Insights', 'Link concepts by dragging from one handle to another. Relationships can have custom labels.', 600, 100, 260, 160, '#f43f5e', 0, 0, ?, ?),
              (?, ?, 'Cloudflare D1 Persistence', 'Powered by SQLite on Cloudflare D1. All changes, positions, and connections persist across refreshes.', 600, 300, 260, 160, '#d946ef', 0, 0, ?, ?)
          `).bind(n1Id, workspaceId, now, now, n2Id, workspaceId, now, now, n3Id, workspaceId, now, now).run();

          // Seed connections
          await env.DB.prepare(`
            INSERT INTO connections (id, workspace_id, source_node_id, target_node_id, relationship, created_at)
            VALUES 
              ('conn-welcome-1', ?, ?, ?, 'explores', ?),
              ('conn-welcome-2', ?, ?, ?, 'persists to', ?)
          `).bind(workspaceId, n1Id, n2Id, now, workspaceId, n1Id, n3Id, now).run();

          // Seed tags
          await env.DB.prepare(`
            INSERT OR IGNORE INTO tags (id, workspace_id, name, created_at)
            VALUES 
              ('tag-welcome-1', ?, 'Knowledge', ?),
              ('tag-welcome-2', ?, 'Architecture', ?)
          `).bind(workspaceId, now, workspaceId, now).run();

          await env.DB.prepare(`
            INSERT OR IGNORE INTO node_tags (node_id, tag_id)
            VALUES (?, 'tag-welcome-1'), (?, 'tag-welcome-2')
          `).bind(n1Id, n3Id).run();

          const refreshed = await nodesStmt.all();
          nodesRaw = refreshed.results;
        }

        const nodes = (nodesRaw || []) as unknown as NodeRecord[];

        // Fetch node tags
        const nodeTagsStmt = env.DB.prepare(`
          SELECT nt.node_id, t.name as tag_name, t.id as tag_id
          FROM node_tags nt
          JOIN tags t ON nt.tag_id = t.id
          WHERE t.workspace_id = ?
        `).bind(workspaceId);
        const { results: nodeTags } = await nodeTagsStmt.all();

        // Attach tags to nodes
        const tagMap: Record<string, string[]> = {};
        for (const row of (nodeTags || []) as { node_id: string; tag_name: string }[]) {
          if (!tagMap[row.node_id]) tagMap[row.node_id] = [];
          tagMap[row.node_id].push(row.tag_name);
        }
        const enrichedNodes = nodes.map((node) => ({
          ...node,
          tags: tagMap[node.id] || [],
        }));

        // Fetch connections
        const connStmt = env.DB.prepare(
          'SELECT * FROM connections WHERE workspace_id = ? ORDER BY created_at ASC'
        ).bind(workspaceId);
        const { results: connections } = await connStmt.all();

        // Fetch tags
        const tagsStmt = env.DB.prepare(
          'SELECT * FROM tags WHERE workspace_id = ? ORDER BY name ASC'
        ).bind(workspaceId);
        const { results: tags } = await tagsStmt.all();

        // Fetch viewport settings
        const vpStmt = env.DB.prepare(
          'SELECT * FROM workspace_settings WHERE workspace_id = ?'
        ).bind(workspaceId);
        const viewport = await vpStmt.first();

        return jsonResponse({
          workspace,
          nodes: enrichedNodes,
          connections: connections || [],
          tags: tags || [],
          viewport: viewport || { viewport_x: 0, viewport_y: 0, zoom: 1 },
        });
      }

      const workspaceViewportMatch = path.match(/^\/api\/workspaces\/([^/]+)\/viewport$/);
      if (workspaceViewportMatch && request.method === 'POST') {
        const workspaceId = workspaceViewportMatch[1];
        const body = await request.json() as { viewport_x: number; viewport_y: number; zoom: number };
        const now = new Date().toISOString();

        await env.DB.prepare(`
          INSERT INTO workspace_settings (workspace_id, viewport_x, viewport_y, zoom, updated_at)
          VALUES (?, ?, ?, ?, ?)
          ON CONFLICT(workspace_id) DO UPDATE SET
            viewport_x = excluded.viewport_x,
            viewport_y = excluded.viewport_y,
            zoom = excluded.zoom,
            updated_at = excluded.updated_at
        `).bind(workspaceId, body.viewport_x || 0, body.viewport_y || 0, body.zoom || 1, now).run();

        return jsonResponse({ success: true });
      }

      const workspacePatchMatch = path.match(/^\/api\/workspaces\/([^/]+)$/);
      if (workspacePatchMatch && request.method === 'PATCH') {
        const workspaceId = workspacePatchMatch[1];
        const body = await request.json() as { name?: string; color?: string };
        const now = new Date().toISOString();

        if (body.name && body.color) {
          try {
            await env.DB.prepare(
              'UPDATE workspaces SET name = ?, color = ?, updated_at = ? WHERE id = ?'
            ).bind(body.name.trim(), body.color, now, workspaceId).run();
          } catch {
            try {
              await env.DB.prepare('ALTER TABLE workspaces ADD COLUMN color TEXT').run();
              await env.DB.prepare(
                'UPDATE workspaces SET name = ?, color = ?, updated_at = ? WHERE id = ?'
              ).bind(body.name.trim(), body.color, now, workspaceId).run();
            } catch {
              await env.DB.prepare(
                'UPDATE workspaces SET name = ?, updated_at = ? WHERE id = ?'
              ).bind(body.name.trim(), now, workspaceId).run();
            }
          }
        } else if (body.name) {
          await env.DB.prepare(
            'UPDATE workspaces SET name = ?, updated_at = ? WHERE id = ?'
          ).bind(body.name.trim(), now, workspaceId).run();
        } else if (body.color) {
          try {
            await env.DB.prepare(
              'UPDATE workspaces SET color = ?, updated_at = ? WHERE id = ?'
            ).bind(body.color, now, workspaceId).run();
          } catch {
            try {
              await env.DB.prepare('ALTER TABLE workspaces ADD COLUMN color TEXT').run();
              await env.DB.prepare(
                'UPDATE workspaces SET color = ?, updated_at = ? WHERE id = ?'
              ).bind(body.color, now, workspaceId).run();
            } catch {}
          }
        }

        return jsonResponse({ success: true });
      }

      if (workspacePatchMatch && request.method === 'DELETE') {
        const workspaceId = workspacePatchMatch[1];
        await env.DB.prepare('DELETE FROM workspaces WHERE id = ?').bind(workspaceId).run();
        return jsonResponse({ success: true, id: workspaceId });
      }

      // Board state snapshot and node sync endpoint for TldrawBoard
      const workspaceBoardMatch = path.match(/^\/api\/workspaces\/([^/]+)\/board$/);
      if (workspaceBoardMatch && request.method === 'GET') {
        const workspaceId = workspaceBoardMatch[1];
        const snapshotRow = await env.DB.prepare(
          'SELECT snapshot, updated_at FROM board_snapshots WHERE workspace_id = ?'
        ).bind(workspaceId).first<{ snapshot: string; updated_at: string }>();

        const nodesStmt = env.DB.prepare('SELECT * FROM nodes WHERE workspace_id = ?').bind(workspaceId);
        const { results: nodes } = await nodesStmt.all();

        return jsonResponse({
          workspaceId,
          snapshot: snapshotRow ? JSON.parse(snapshotRow.snapshot) : null,
          nodes: nodes || [],
          updated_at: snapshotRow?.updated_at || null,
        });
      }

      if (workspaceBoardMatch && (request.method === 'POST' || request.method === 'PUT')) {
        const workspaceId = workspaceBoardMatch[1];
        const body = (await request.json()) as {
          snapshot?: any;
          nodes?: Array<{
            id: string;
            title?: string;
            content?: string;
            position_x?: number;
            position_y?: number;
            width?: number;
            height?: number;
            color?: string;
          }>;
          connections?: Array<{
            id: string;
            source_node_id: string;
            target_node_id: string;
            relationship?: string;
          }>;
        };
        const now = new Date().toISOString();

        // Build all D1 statements up-front and execute in a single batch
        // to avoid multiple sequential round-trips to the SQLite layer.
        const batchStatements: ReturnType<typeof env.DB.prepare>[] = [];

        // 1. Upsert workspace
        batchStatements.push(
          env.DB.prepare(
            'INSERT INTO workspaces (id, name, created_at, updated_at) VALUES (?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET updated_at = excluded.updated_at'
          ).bind(workspaceId, 'Flowchart', now, now)
        );

        // 2. Upsert snapshot (only when provided — full-save on exit)
        if (body.snapshot) {
          const snapshotStr = typeof body.snapshot === 'string' ? body.snapshot : JSON.stringify(body.snapshot);
          batchStatements.push(
            env.DB.prepare(`
              INSERT INTO board_snapshots (workspace_id, snapshot, updated_at)
              VALUES (?, ?, ?)
              ON CONFLICT(workspace_id) DO UPDATE SET
                snapshot = excluded.snapshot,
                updated_at = excluded.updated_at
            `).bind(workspaceId, snapshotStr, now)
          );
        }

        // 3. Upsert nodes
        if (Array.isArray(body.nodes) && body.nodes.length > 0) {
          for (const n of body.nodes) {
            batchStatements.push(
              env.DB.prepare(`
                INSERT INTO nodes (id, workspace_id, title, content, position_x, position_y, width, height, color, is_favorite, is_deleted, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, ?, ?)
                ON CONFLICT(id) DO UPDATE SET
                  title = excluded.title,
                  content = excluded.content,
                  position_x = excluded.position_x,
                  position_y = excluded.position_y,
                  width = excluded.width,
                  height = excluded.height,
                  color = excluded.color,
                  updated_at = excluded.updated_at
              `).bind(
                n.id,
                workspaceId,
                n.title || 'Node',
                n.content || '',
                n.position_x || 0,
                n.position_y || 0,
                n.width || 200,
                n.height || 68,
                n.color || '#EF3167',
                now,
                now
              )
            );
          }
        }

        // 4. Upsert connections
        if (Array.isArray(body.connections) && body.connections.length > 0) {
          for (const c of body.connections) {
            batchStatements.push(
              env.DB.prepare(`
                INSERT INTO connections (id, workspace_id, source_node_id, target_node_id, relationship, created_at)
                VALUES (?, ?, ?, ?, ?, ?)
                ON CONFLICT(id) DO UPDATE SET
                  relationship = excluded.relationship
              `).bind(c.id, workspaceId, c.source_node_id, c.target_node_id, c.relationship || null, now)
            );
          }
        }

        // Execute all statements in one D1 round-trip
        await env.DB.batch(batchStatements);

        return jsonResponse({ success: true, workspaceId, updated_at: now });
      }

      // 2. Nodes endpoints
      if (path === '/api/nodes' && request.method === 'POST') {
        const body = await request.json() as {
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
        };

        if (!body.workspace_id || !body.title) {
          return jsonResponse({ error: 'workspace_id and title are required' }, 400);
        }

        const id = body.id || `node-${crypto.randomUUID()}`;
        const now = new Date().toISOString();
        const posX = body.position_x ?? 100;
        const posY = body.position_y ?? 100;
        const width = body.width ?? 260;
        const height = body.height ?? 160;
        const color = body.color ?? '#1e293b';
        const content = body.content ?? '';

        await env.DB.prepare(`
          INSERT INTO nodes (id, workspace_id, title, content, position_x, position_y, width, height, color, is_favorite, is_deleted, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, ?, ?)
        `).bind(id, body.workspace_id, body.title, content, posX, posY, width, height, color, now, now).run();

        // Handle tags
        if (body.tags && body.tags.length > 0) {
          for (const tagName of body.tags) {
            const cleanTag = tagName.trim();
            if (!cleanTag) continue;
            // Check or insert tag
            let tag = await env.DB.prepare(
              'SELECT id FROM tags WHERE workspace_id = ? AND name = ?'
            ).bind(body.workspace_id, cleanTag).first<{ id: string }>();

            if (!tag) {
              const tagId = `tag-${crypto.randomUUID()}`;
              await env.DB.prepare(
                'INSERT INTO tags (id, workspace_id, name, created_at) VALUES (?, ?, ?, ?)'
              ).bind(tagId, body.workspace_id, cleanTag, now).run();
              tag = { id: tagId };
            }

            await env.DB.prepare(
              'INSERT OR IGNORE INTO node_tags (node_id, tag_id) VALUES (?, ?)'
            ).bind(id, tag.id).run();
          }
        }

        return jsonResponse({
          id,
          workspace_id: body.workspace_id,
          title: body.title,
          content,
          position_x: posX,
          position_y: posY,
          width,
          height,
          color,
          is_favorite: 0,
          is_deleted: 0,
          created_at: now,
          updated_at: now,
          tags: body.tags || [],
        }, 201);
      }

      if (path === '/api/nodes/batch-positions' && request.method === 'PATCH') {
        const body = await request.json() as { positions: { id: string; position_x: number; position_y: number }[] };
        if (!body.positions || !Array.isArray(body.positions)) {
          return jsonResponse({ error: 'positions array is required' }, 400);
        }

        const now = new Date().toISOString();
        const batchStatements = body.positions.map((item) =>
          env.DB.prepare(
            'UPDATE nodes SET position_x = ?, position_y = ?, updated_at = ? WHERE id = ?'
          ).bind(item.position_x, item.position_y, now, item.id)
        );

        if (batchStatements.length > 0) {
          await env.DB.batch(batchStatements);
        }

        return jsonResponse({ success: true, count: batchStatements.length });
      }

      const nodeDetailMatch = path.match(/^\/api\/nodes\/([^/]+)$/);
      if (nodeDetailMatch) {
        const nodeId = nodeDetailMatch[1];

        if (request.method === 'GET') {
          const node = await env.DB.prepare('SELECT * FROM nodes WHERE id = ?').bind(nodeId).first();
          if (!node) {
            return jsonResponse({ error: 'Node not found' }, 404);
          }

          const tagsRes = await env.DB.prepare(`
            SELECT t.name FROM tags t
            JOIN node_tags nt ON t.id = nt.tag_id
            WHERE nt.node_id = ?
          `).bind(nodeId).all<{ name: string }>();

          return jsonResponse({
            ...node,
            tags: (tagsRes.results || []).map((t: { name: string }) => t.name),
          });
        }

        if (request.method === 'PATCH') {
          const body = await request.json() as {
            title?: string;
            content?: string;
            position_x?: number;
            position_y?: number;
            width?: number;
            height?: number;
            color?: string;
            is_favorite?: number;
            is_deleted?: number;
            tags?: string[];
          };

          const now = new Date().toISOString();
          const node = await env.DB.prepare('SELECT * FROM nodes WHERE id = ?').bind(nodeId).first<NodeRecord>();
          if (!node) {
            return jsonResponse({ error: 'Node not found' }, 404);
          }

          const newTitle = body.title !== undefined ? body.title : node.title;
          const newContent = body.content !== undefined ? body.content : node.content;
          const newPosX = body.position_x !== undefined ? body.position_x : node.position_x;
          const newPosY = body.position_y !== undefined ? body.position_y : node.position_y;
          const newWidth = body.width !== undefined ? body.width : node.width;
          const newHeight = body.height !== undefined ? body.height : node.height;
          const newColor = body.color !== undefined ? body.color : node.color;
          const newFav = body.is_favorite !== undefined ? body.is_favorite : node.is_favorite;
          const newDel = body.is_deleted !== undefined ? body.is_deleted : node.is_deleted;

          await env.DB.prepare(`
            UPDATE nodes SET
              title = ?,
              content = ?,
              position_x = ?,
              position_y = ?,
              width = ?,
              height = ?,
              color = ?,
              is_favorite = ?,
              is_deleted = ?,
              updated_at = ?
            WHERE id = ?
          `).bind(newTitle, newContent, newPosX, newPosY, newWidth, newHeight, newColor, newFav, newDel, now, nodeId).run();

          // Sync tags if provided
          if (body.tags !== undefined) {
            await env.DB.prepare('DELETE FROM node_tags WHERE node_id = ?').bind(nodeId).run();
            for (const tagName of body.tags) {
              const cleanTag = tagName.trim();
              if (!cleanTag) continue;
              let tag = await env.DB.prepare(
                'SELECT id FROM tags WHERE workspace_id = ? AND name = ?'
              ).bind(node.workspace_id, cleanTag).first<{ id: string }>();

              if (!tag) {
                const tagId = `tag-${crypto.randomUUID()}`;
                await env.DB.prepare(
                  'INSERT INTO tags (id, workspace_id, name, created_at) VALUES (?, ?, ?, ?)'
                ).bind(tagId, node.workspace_id, cleanTag, now).run();
                tag = { id: tagId };
              }

              await env.DB.prepare(
                'INSERT OR IGNORE INTO node_tags (node_id, tag_id) VALUES (?, ?)'
              ).bind(nodeId, tag.id).run();
            }
          }

          return jsonResponse({
            id: nodeId,
            workspace_id: node.workspace_id,
            title: newTitle,
            content: newContent,
            position_x: newPosX,
            position_y: newPosY,
            width: newWidth,
            height: newHeight,
            color: newColor,
            is_favorite: newFav,
            is_deleted: newDel,
            updated_at: now,
            tags: body.tags !== undefined ? body.tags : undefined,
          });
        }

        if (request.method === 'DELETE') {
          // Permanently delete node (cascades to connections and node_tags)
          await env.DB.prepare('DELETE FROM nodes WHERE id = ?').bind(nodeId).run();
          return jsonResponse({ success: true, id: nodeId });
        }
      }

      const nodeConnectionsMatch = path.match(/^\/api\/nodes\/([^/]+)\/connections$/);
      if (nodeConnectionsMatch && request.method === 'GET') {
        const nodeId = nodeConnectionsMatch[1];
        const res = await env.DB.prepare(`
          SELECT * FROM connections
          WHERE source_node_id = ? OR target_node_id = ?
          ORDER BY created_at ASC
        `).bind(nodeId, nodeId).all();

        return jsonResponse(res.results || []);
      }

      // 3. Connections endpoints
      if (path === '/api/connections' && request.method === 'POST') {
        const body = await request.json() as {
          id?: string;
          workspace_id: string;
          source_node_id: string;
          target_node_id: string;
          relationship?: string;
        };

        if (!body.workspace_id || !body.source_node_id || !body.target_node_id) {
          return jsonResponse({ error: 'workspace_id, source_node_id, and target_node_id are required' }, 400);
        }

        // Validate source and target nodes exist in the workspace
        const sourceCheck = await env.DB.prepare('SELECT id FROM nodes WHERE id = ? AND workspace_id = ?')
          .bind(body.source_node_id, body.workspace_id).first();
        const targetCheck = await env.DB.prepare('SELECT id FROM nodes WHERE id = ? AND workspace_id = ?')
          .bind(body.target_node_id, body.workspace_id).first();

        if (!sourceCheck || !targetCheck) {
          return jsonResponse({ error: 'Source or target node not found in this workspace' }, 400);
        }

        // Prevent duplicate connection
        const existing = await env.DB.prepare(`
          SELECT id FROM connections
          WHERE workspace_id = ? AND source_node_id = ? AND target_node_id = ?
        `).bind(body.workspace_id, body.source_node_id, body.target_node_id).first<{ id: string }>();

        if (existing) {
          return jsonResponse({ error: 'Connection already exists', existingId: existing.id }, 409);
        }

        const id = body.id || `conn-${crypto.randomUUID()}`;
        const now = new Date().toISOString();
        const relationship = body.relationship ?? null;

        await env.DB.prepare(`
          INSERT INTO connections (id, workspace_id, source_node_id, target_node_id, relationship, created_at)
          VALUES (?, ?, ?, ?, ?, ?)
        `).bind(id, body.workspace_id, body.source_node_id, body.target_node_id, relationship, now).run();

        return jsonResponse({
          id,
          workspace_id: body.workspace_id,
          source_node_id: body.source_node_id,
          target_node_id: body.target_node_id,
          relationship,
          created_at: now,
        }, 201);
      }

      const connectionDetailMatch = path.match(/^\/api\/connections\/([^/]+)$/);
      if (connectionDetailMatch && request.method === 'DELETE') {
        const connId = connectionDetailMatch[1];
        await env.DB.prepare('DELETE FROM connections WHERE id = ?').bind(connId).run();
        return jsonResponse({ success: true, id: connId });
      }

      // 4. Search endpoint
      if (path === '/api/search' && request.method === 'GET') {
        const query = url.searchParams.get('q') || '';
        const workspaceId = url.searchParams.get('workspace_id');

        if (!workspaceId) {
          return jsonResponse({ error: 'workspace_id query param is required' }, 400);
        }

        const pattern = `%${query.trim()}%`;
        const res = await env.DB.prepare(`
          SELECT n.*, (
            SELECT GROUP_CONCAT(t.name, ',')
            FROM node_tags nt
            JOIN tags t ON nt.tag_id = t.id
            WHERE nt.node_id = n.id
          ) as tags_string
          FROM nodes n
          WHERE n.workspace_id = ? AND n.is_deleted = 0
            AND (n.title LIKE ? OR n.content LIKE ?)
          ORDER BY n.updated_at DESC
          LIMIT 50
        `).bind(workspaceId, pattern, pattern).all();

        const results = (res.results || []).map((row: any) => ({
          ...row,
          tags: row.tags_string ? row.tags_string.split(',') : [],
        }));

        return jsonResponse(results);
      }

      // 5. Tags endpoints
      if (path === '/api/tags' && request.method === 'GET') {
        const workspaceId = url.searchParams.get('workspace_id');
        if (!workspaceId) {
          return jsonResponse({ error: 'workspace_id is required' }, 400);
        }
        const res = await env.DB.prepare('SELECT * FROM tags WHERE workspace_id = ? ORDER BY name ASC')
          .bind(workspaceId).all();
        return jsonResponse(res.results || []);
      }

      if (path === '/api/tags' && request.method === 'POST') {
        const body = await request.json() as { workspace_id: string; name: string };
        if (!body.workspace_id || !body.name) {
          return jsonResponse({ error: 'workspace_id and name are required' }, 400);
        }
        const now = new Date().toISOString();
        const id = `tag-${crypto.randomUUID()}`;
        await env.DB.prepare(
          'INSERT INTO tags (id, workspace_id, name, created_at) VALUES (?, ?, ?, ?)'
        ).bind(id, body.workspace_id, body.name.trim(), now).run();

        return jsonResponse({ id, workspace_id: body.workspace_id, name: body.name.trim(), created_at: now }, 201);
      }

      // If static assets fetcher exists and path is not an API path, pass through to assets
      if (env.ASSETS) {
        return await env.ASSETS.fetch(request);
      }

      return jsonResponse({ error: 'Not Found' }, 404);
    } catch (err: any) {
      console.error('Worker error:', err);
      return jsonResponse({ error: err.message || 'Internal server error' }, 500);
    }
  },
};
