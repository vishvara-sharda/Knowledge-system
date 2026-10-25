// Comprehensive automated verification test for Cloudflare D1 + Worker API

const BASE_URL = 'http://127.0.0.1:5173/api';

async function runTests() {
  console.log('🧪 Starting Cloudflare D1 Knowledge Workspace API Tests...\n');
  let passed = 0;
  let failed = 0;

  async function assert(desc: string, fn: () => Promise<boolean>) {
    try {
      const ok = await fn();
      if (ok) {
        console.log(`  ✅ PASS: ${desc}`);
        passed++;
      } else {
        console.error(`  ❌ FAIL: ${desc}`);
        failed++;
      }
    } catch (err: any) {
      console.error(`  ❌ FAIL: ${desc} - ${err.message}`);
      failed++;
    }
  }

  let testWsId = '';
  let nodeAId = '';
  let nodeBId = '';
  let nodeCId = '';
  let connABId = '';
  let connACId = '';

  // 1. Workspaces
  await assert('Create a new workspace', async () => {
    const res = await fetch(`${BASE_URL}/workspaces`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Integration Test Workspace' }),
    });
    const data = await res.json() as any;
    testWsId = data.id;
    return res.status === 201 && data.name === 'Integration Test Workspace';
  });

  await assert('List workspaces includes created workspace', async () => {
    const res = await fetch(`${BASE_URL}/workspaces`);
    const list = await res.json() as any[];
    return list.some((ws) => ws.id === testWsId);
  });

  // 2. Node Creation & Persistence
  await assert('Create Node A with tags and position', async () => {
    const res = await fetch(`${BASE_URL}/nodes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        workspace_id: testWsId,
        title: 'Core Architecture',
        content: 'System design and component architecture notes.',
        position_x: 100,
        position_y: 150,
        color: '#6366f1',
        tags: ['Architecture', 'Backend'],
      }),
    });
    const data = await res.json() as any;
    nodeAId = data.id;
    return res.status === 201 && data.title === 'Core Architecture' && data.tags.includes('Architecture');
  });

  await assert('Create Node B and Node C', async () => {
    const resB = await fetch(`${BASE_URL}/nodes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        workspace_id: testWsId,
        title: 'Database Layer (Cloudflare D1)',
        content: 'SQLite relational persistence.',
        position_x: 450,
        position_y: 100,
        color: '#10b981',
        tags: ['Database'],
      }),
    });
    const dataB = await resB.json() as any;
    nodeBId = dataB.id;

    const resC = await fetch(`${BASE_URL}/nodes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        workspace_id: testWsId,
        title: 'Canvas UI (React Flow)',
        content: 'Interactive graph visualization.',
        position_x: 450,
        position_y: 300,
        color: '#3b82f6',
        tags: ['Frontend'],
      }),
    });
    const dataC = await resC.json() as any;
    nodeCId = dataC.id;

    return Boolean(nodeBId && nodeCId);
  });

  // 3. Node Editing & Batch Position Autosave
  await assert('Edit Node A title, content, and favorite status', async () => {
    const res = await fetch(`${BASE_URL}/nodes/${nodeAId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Core Architecture (Updated)',
        is_favorite: 1,
      }),
    });
    const data = await res.json() as any;
    return data.title === 'Core Architecture (Updated)' && data.is_favorite === 1;
  });

  await assert('Batch update node positions (simulating drag autosave)', async () => {
    const res = await fetch(`${BASE_URL}/nodes/batch-positions`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        positions: [
          { id: nodeAId, position_x: 120, position_y: 160 },
          { id: nodeBId, position_x: 480, position_y: 110 },
        ],
      }),
    });
    const data = await res.json() as any;
    return data.success === true && data.count === 2;
  });

  // 4. Many-to-Many Connections
  await assert('Connect Node A -> Node B with relationship', async () => {
    const res = await fetch(`${BASE_URL}/connections`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        workspace_id: testWsId,
        source_node_id: nodeAId,
        target_node_id: nodeBId,
        relationship: 'persists to',
      }),
    });
    const data = await res.json() as any;
    connABId = data.id;
    return res.status === 201 && data.relationship === 'persists to';
  });

  await assert('Connect Node A -> Node C (one-to-many relationship)', async () => {
    const res = await fetch(`${BASE_URL}/connections`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        workspace_id: testWsId,
        source_node_id: nodeAId,
        target_node_id: nodeCId,
        relationship: 'renders via',
      }),
    });
    const data = await res.json() as any;
    connACId = data.id;
    return res.status === 201;
  });

  await assert('Prevent duplicate connection between same nodes', async () => {
    const res = await fetch(`${BASE_URL}/connections`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        workspace_id: testWsId,
        source_node_id: nodeAId,
        target_node_id: nodeBId,
      }),
    });
    return res.status === 409;
  });

  // 5. Search Functionality
  await assert('Search nodes by keyword matches title or content', async () => {
    const res = await fetch(`${BASE_URL}/search?workspace_id=${testWsId}&q=SQLite`);
    const results = await res.json() as any[];
    return results.length === 1 && results[0].id === nodeBId;
  });

  // 6. Viewport Persistence
  await assert('Persist canvas camera viewport settings', async () => {
    const res = await fetch(`${BASE_URL}/workspaces/${testWsId}/viewport`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        viewport_x: 250,
        viewport_y: 120,
        zoom: 1.25,
      }),
    });
    const data = await res.json() as any;
    return data.success === true;
  });

  // 7. Graph Restoration
  await assert('Full Workspace Graph retrieval restores nodes, connections, and viewport', async () => {
    const res = await fetch(`${BASE_URL}/workspaces/${testWsId}/graph`);
    const graph = await res.json() as any;
    const hasNodes = graph.nodes.length === 3;
    const hasConns = graph.connections.length === 2;
    const hasVp = graph.viewport && graph.viewport.zoom === 1.25;
    return hasNodes && hasConns && hasVp;
  });

  // 8. Connection Deletion
  await assert('Delete connection independently without deleting nodes', async () => {
    const res = await fetch(`${BASE_URL}/connections/${connABId}`, {
      method: 'DELETE',
    });
    const data = await res.json() as any;

    const checkRes = await fetch(`${BASE_URL}/workspaces/${testWsId}/graph`);
    const graph = await checkRes.json() as any;

    return data.success === true && graph.connections.length === 1 && graph.nodes.length === 3;
  });

  // 9. Node Deletion & Cascade Referential Integrity
  await assert('Deleting Node A automatically cascades to remove remaining connections', async () => {
    const res = await fetch(`${BASE_URL}/nodes/${nodeAId}`, {
      method: 'DELETE',
    });
    const data = await res.json() as any;

    const checkRes = await fetch(`${BASE_URL}/workspaces/${testWsId}/graph`);
    const graph = await checkRes.json() as any;

    // Remaining connections should be 0 because connACId referenced node A
    // Node B and Node C should still be intact!
    const nodeIds = graph.nodes.map((n: any) => n.id);
    return data.success === true && graph.connections.length === 0 && !nodeIds.includes(nodeAId) && nodeIds.includes(nodeBId);
  });

  console.log(`\n📊 Test Summary: ${passed} passed, ${failed} failed.\n`);
  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
