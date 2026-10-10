export type AppName = 'web' | 'admin';

export type AppRouteInventoryEntry = {
  path: string;
  featurePath: string | null;
  element: string;
  file: string;
};

export declare function readAppRouteInventory(
  root: string,
  appName: AppName,
): AppRouteInventoryEntry[];
