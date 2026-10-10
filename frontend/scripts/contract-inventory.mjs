// Development tooling only. Runtime apps never import the provisional server.
const modules = [
  ['auth', 'flow-a-auth', 'authRoutes'],
  ['catalog', 'flow-b-catalog', 'catalogRoutes'],
  ['learning', 'flow-c-learning', 'learningRoutes'],
  ['assessment', 'flow-d-assessment', 'assessmentRoutes'],
  ['authoring', 'flow-e-authoring', 'authoringRoutes'],
  ['payment', 'flow-f-payments', 'paymentRoutes'],
  ['ai', 'flow-g-ai', 'aiRoutes'],
  ['blog', 'flow-h-blog', 'blogRoutes'],
  ['management', 'management', 'managementRoutes'],
];

export async function inventoryMockOperations() {
  const operations = [];
  for (const [flow, file, exportName] of modules) {
    const module = await import(`../tools/provisional-api/${file}.ts`);
    for (const route of module[exportName]) {
      operations.push({
        flow, method: route.method,
        path: '/' + route.path.replace(/:([A-Za-z_]+)/g, '{$1}'),
        source: `tools/provisional-api/${file}.ts`,
      });
    }
  }
  return operations;
}
